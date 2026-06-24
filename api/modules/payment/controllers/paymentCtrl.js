/**
 * Payment Gateway Controller
 * Razorpay wallet top-up, wired to the double-entry ledger. LIVE gateway only —
 * there is no mock mode; payments always go through Razorpay.
 *
 * Flow:
 *   1. POST /payment/create-order  -> create a real Razorpay order + audit row.
 *                                     Returns the PUBLISHABLE key id only.
 *   2. App completes payment via the Razorpay checkout.
 *   3. POST /payment/verify        -> verify the signature, then credit the wallet via
 *                                     ledgerService.walletTopup (single source of truth,
 *                                     idempotent, double-entry + audit trail).
 *
 * All Razorpay credentials are read server-side from config/razorpay.config.js
 * (environment variables only); only the publishable key id is ever sent to the client.
 */

const std = require(appRoot + "/utils/standardMessages");
const df = require(appRoot + "/utils/dateFormatUtil");
const rzp = require(appRoot + "/config/razorpay.config");
const paymentMdl = require("../models/paymentMdl");
const ledger = require(appRoot + "/api/modules/ledger/services/ledgerService");
const cntxtDtls = "paymentCtrl";

function badRequest(res, message) {
  return res.status(std.message["BAD_REQUEST"].code).json({
    status: std.message["BAD_REQUEST"].code,
    message,
    data: null,
  });
}

/*****************************************************************************
 * Function      : createOrder
 * Description   : Create a real Razorpay order and record an audit row.
 *                 Fails (no mock fallback) if the gateway is unavailable.
 ******************************************************************************/
exports.createOrder = function (req, res) {
  const fnm = "createOrder";
  const userId = req.user.userId;
  const body = req.body.data || req.body;
  const amount = Number(body.amount);
  const currency = body.currency || "INR";
  const paymentMethod = body.payment_method || "upi";

  if (!amount || amount <= 0 || isNaN(amount)) {
    return badRequest(res, "Invalid amount");
  }

  let razorpay;
  try {
    razorpay = rzp.getInstance();
  } catch (e) {
    console.error("[createOrder] gateway not configured:", e);
    return df.formatErrorRes(res, e, cntxtDtls, fnm, {});
  }

  razorpay.orders.create(
    {
      amount: Math.round(amount * 100),
      currency,
      receipt: `wallet_${userId}_${Date.now()}`,
      notes: {
        userId: String(userId),
        payment_method: paymentMethod,
        description: "Wallet Top-up",
      },
    },
    function (err, order) {
      if (err) {
        console.error("[createOrder] Razorpay order creation failed:", err);
        return df.formatErrorRes(
          res,
          { err_status: 502, err_message: "Failed to create payment order" },
          cntxtDtls,
          fnm,
          {},
        );
      }

      // Record the order so verify can trust the amount (not the client).
      paymentMdl
        .createOrderAuditMdl({
          userId,
          orderId: order.id,
          amount,
          currency,
          purpose: "wallet_topup",
          paymentMethod,
        })
        .catch((e) => console.error("[createOrder] audit insert failed:", e));

      return df.formatSucessRes(
        req,
        res,
        {
          order_id: order.id,
          amount: amount,
          currency: currency,
          key_id: rzp.getPublicKeyId(), // publishable key only
        },
        cntxtDtls,
        fnm,
        { message: "Payment order created" },
      );
    },
  );
};

/*****************************************************************************
 * Function      : verifyPayment
 * Description   : Verify the Razorpay signature, then credit the wallet via the
 *                 ledger. Idempotent: re-verifying a paid order returns the same result.
 ******************************************************************************/
exports.verifyPayment = function (req, res) {
  const fnm = "verifyPayment";
  const userId = req.user.userId;
  const body = req.body.data || req.body;
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return badRequest(
      res,
      "Missing razorpay_order_id, razorpay_payment_id or razorpay_signature",
    );
  }

  paymentMdl
    .getOrderByRzpIdMdl({ orderId: razorpay_order_id, userId })
    .then(async function (rows) {
      const order = rows && rows[0];
      if (!order) {
        return badRequest(res, "Unknown payment order");
      }

      // Idempotency: already credited -> return current balance, do NOT double credit.
      if (order.sttus_cd === "paid") {
        const bal = await ledger.getWalletBalance(userId);
        return df.formatSucessRes(
          req,
          res,
          {
            verified: true,
            already_processed: true,
            order_id: razorpay_order_id,
            payment_id: order.rzrpy_pymnt_id_tx,
            journal_id: order.jrnl_id,
            new_balance: bal,
          },
          cntxtDtls,
          fnm,
          { message: "Payment already processed" },
        );
      }

      // Verify the Razorpay checkout signature (always).
      const ok = rzp.verifyPaymentSignature(
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
      );
      if (!ok) {
        await paymentMdl
          .markOrderFailedMdl({ orderAuditId: order.pay_ordr_id })
          .catch(() => {});
        return badRequest(res, "Payment verification failed: invalid signature");
      }

      // ---- Credit the wallet through the ledger (trusted amount from the audit row) ----
      const amount = parseFloat(order.amt) || 0;
      const paymentMethod = order.pymnt_mthd_cd || "upi";

      const jr = await ledger.walletTopup({
        userId,
        amount,
        paymentMethod,
        paymentDetails: {
          order_id: razorpay_order_id,
          payment_id: razorpay_payment_id,
        },
        idempotencyKey: `topup:order:${order.pay_ordr_id}`,
        refType: "pay_order",
        refId: order.pay_ordr_id,
        audit: {
          actnCd: "wallet_topup",
          userId,
          ip: req.ip,
          userAgent: req.headers["user-agent"],
        },
      });

      const newBalance = await ledger.getWalletBalance(userId);

      await paymentMdl.markOrderPaidMdl({
        orderAuditId: order.pay_ordr_id,
        paymentId: razorpay_payment_id,
        signature: razorpay_signature,
        jrnlId: jr.jrnlId,
      });

      return df.formatSucessRes(
        req,
        res,
        {
          verified: true,
          order_id: razorpay_order_id,
          payment_id: razorpay_payment_id,
          journal_id: jr.jrnlId,
          amount: amount,
          new_balance: newBalance,
        },
        cntxtDtls,
        fnm,
        { message: "Payment verified & wallet credited" },
      );
    })
    .catch(async function (error) {
      const msg = (error && (error.sqlMessage || error.err_message || error.message)) || "";
      const isDuplicate =
        (error && error.code === "ER_DUP_ENTRY") || /duplicate entry/i.test(msg);
      if (isDuplicate) {
        try {
          const bal = await ledger.getWalletBalance(userId);
          return df.formatSucessRes(
            req,
            res,
            {
              verified: true,
              already_processed: true,
              order_id: razorpay_order_id,
              new_balance: bal,
            },
            cntxtDtls,
            fnm,
            { message: "Payment already processed" },
          );
        } catch (_) {
          /* fall through to the generic error response */
        }
      }
      console.error("[verifyPayment] Error:", error);
      return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
    });
};
