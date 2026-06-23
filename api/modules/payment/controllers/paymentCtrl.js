/**
 * Payment Gateway Controller
 * Razorpay wallet top-up. Currently runs in MOCK mode unless live keys are set.
 *
 * Flow:
 *   1. POST /payment/create-order  -> creates a (mock or live) order + audit row
 *   2. App completes payment (mock = instant, live = Razorpay checkout)
 *   3. POST /payment/verify        -> verifies, then CREDITS the wallet server-side
 *                                     (single source of truth, idempotent) + marks audit paid
 */

const crypto = require('crypto');
const std = require(appRoot + '/utils/standardMessages');
const df = require(appRoot + '/utils/dateFormatUtil');
const paymentMdl = require('../models/paymentMdl');
const walletMdl = require('../../wallet/models/walletMdl');
const cntxtDtls = "paymentCtrl";

const KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_1DP5mmOlF5G5ag';
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';

// We are in mock mode unless a real (non-placeholder) secret is configured.
function isMockMode() {
    return !KEY_SECRET || KEY_SECRET === 'test_secret_key';
}

function badRequest(res, message) {
    return res.status(std.message["BAD_REQUEST"].code).json({
        status: std.message["BAD_REQUEST"].code, message, data: null
    });
}

/*****************************************************************************
* Function      : createOrder
* Description   : Create a payment order (mock or live) and record an audit row
******************************************************************************/
exports.createOrder = function(req, res) {
    const fnm = "createOrder";
    const userId = req.user.userId;
    const body = req.body.data || req.body;
    const amount = Number(body.amount);
    const currency = body.currency || 'INR';
    const paymentMethod = body.payment_method || 'wallet_topup';

    if (!amount || amount <= 0 || isNaN(amount)) {
        return badRequest(res, 'Invalid amount');
    }

    const respond = (orderId, mock) => {
        // Record the order so verify can trust the amount (not the client)
        paymentMdl.createOrderAuditMdl({
            userId, orderId, amount, currency, purpose: 'wallet_topup',
            paymentMethod, isMock: mock
        }).catch((e) => console.error('[createOrder] audit insert failed:', e));

        return df.formatSucessRes(req, res, {
            order_id: orderId,
            amount: amount,
            currency: currency,
            key_id: KEY_ID,
            mock: mock
        }, cntxtDtls, fnm, { message: mock ? 'Payment order created (mock mode)' : 'Payment order created' });
    };

    if (isMockMode()) {
        // Mock order id is explicitly tagged so verify can recognise it.
        return respond(`order_mock_${userId}_${Date.now()}`, true);
    }

    // Live mode
    try {
        const Razorpay = require('razorpay');
        const razorpay = new Razorpay({ key_id: KEY_ID, key_secret: KEY_SECRET });
        razorpay.orders.create({
            amount: Math.round(amount * 100),
            currency,
            receipt: `wallet_${userId}_${Date.now()}`,
            notes: { userId: String(userId), payment_method: paymentMethod, description: 'Wallet Top-up' }
        }, function(err, order) {
            if (err) {
                console.error('[createOrder] Razorpay error, falling back to mock:', err);
                return respond(`order_mock_${userId}_${Date.now()}`, true);
            }
            return respond(order.id, false);
        });
    } catch (error) {
        console.error('[createOrder] error, falling back to mock:', error);
        return respond(`order_mock_${userId}_${Date.now()}`, true);
    }
};

/*****************************************************************************
* Function      : verifyPayment
* Description   : Verify the payment, then credit the wallet server-side.
*                 Idempotent: a re-verify of a paid order returns the same result.
******************************************************************************/
exports.verifyPayment = function(req, res) {
    const fnm = "verifyPayment";
    const userId = req.user.userId;
    const body = req.body.data || req.body;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

    if (!razorpay_order_id) {
        return badRequest(res, 'Missing order id');
    }

    const isMockOrder = String(razorpay_order_id).indexOf('mock') !== -1;

    // Look up the order we recorded at create-time — this is the trusted amount source.
    paymentMdl.getOrderByRzpIdMdl({ orderId: razorpay_order_id, userId })
        .then(function(rows) {
            const order = rows && rows[0];
            if (!order) {
                return badRequest(res, 'Unknown payment order');
            }

            // Idempotency: already credited -> return existing result, do NOT double credit.
            if (order.sttus_cd === 'paid') {
                return walletMdl.getUserWalletMdl({ userId }).then(function(w) {
                    const bal = w && w[0] ? parseFloat(w[0].blnce_amt) || 0 : 0;
                    return df.formatSucessRes(req, res, {
                        verified: true, already_processed: true,
                        order_id: razorpay_order_id, payment_id: order.rzrpy_pymnt_id_tx,
                        transaction_id: order.trxn_id, new_balance: bal, mock: order.is_mock_in === 1
                    }, cntxtDtls, fnm, { message: 'Payment already processed' });
                });
            }

            // Signature check for LIVE orders only.
            if (!isMockOrder && !isMockMode()) {
                const expected = crypto.createHmac('sha256', KEY_SECRET)
                    .update(`${razorpay_order_id}|${razorpay_payment_id}`).digest('hex');
                if (expected !== razorpay_signature) {
                    paymentMdl.markOrderFailedMdl({ orderAuditId: order.pay_ordr_id })
                        .catch(() => {});
                    return badRequest(res, 'Payment verification failed: invalid signature');
                }
            }

            // ---- Credit the wallet (trusted amount from the audit row) ----
            const amount = parseFloat(order.amt) || 0;
            const paymentMethod = order.pymnt_mthd_cd || 'razorpay';

            return creditWallet(userId, amount, paymentMethod, {
                order_id: razorpay_order_id,
                payment_id: razorpay_payment_id || `pay_mock_${Date.now()}`,
                mock: isMockOrder
            }).then(function(result) {
                // Mark the audit row paid + link the wallet transaction
                return paymentMdl.markOrderPaidMdl({
                    orderAuditId: order.pay_ordr_id,
                    paymentId: razorpay_payment_id || `pay_mock_${Date.now()}`,
                    signature: razorpay_signature || null,
                    transactionId: result.transactionId
                }).then(function() {
                    return df.formatSucessRes(req, res, {
                        verified: true,
                        order_id: razorpay_order_id,
                        payment_id: razorpay_payment_id || null,
                        transaction_id: result.transactionId,
                        amount: amount,
                        new_balance: result.newBalance,
                        mock: isMockOrder
                    }, cntxtDtls, fnm, { message: 'Payment verified & wallet credited' });
                });
            });
        })
        .catch(function(error) {
            console.error('[verifyPayment] Error:', error);
            return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
        });
};

/**
 * Credit a user's wallet by `amount`, creating the wallet if needed, and writing
 * a credit/topup transaction. Returns { transactionId, newBalance }.
 */
function creditWallet(userId, amount, paymentMethod, paymentDetails) {
    return walletMdl.getUserWalletMdl({ userId })
        .then(function(walletResults) {
            if (walletResults && walletResults.length > 0) {
                return walletResults[0];
            }
            // create empty wallet, then re-fetch
            return walletMdl.createWalletMdl({ userId, initialAmount: 0.0 })
                .then(function() { return walletMdl.getUserWalletMdl({ userId }); })
                .then(function(rows) {
                    if (!rows || rows.length === 0) throw new Error('Failed to create wallet');
                    return rows[0];
                });
        })
        .then(function(wallet) {
            const balanceBefore = parseFloat(wallet.blnce_amt) || 0;
            const balanceAfter = balanceBefore + parseFloat(amount);

            return walletMdl.addMoneyMdl({ walletId: wallet.wllt_id, amount, userId })
                .then(function(upd) {
                    if (!upd || upd.affectedRows !== 1) throw new Error('Failed to update wallet balance');
                    return walletMdl.createTransactionMdl({
                        walletId: wallet.wllt_id,
                        userId,
                        type: 'credit',
                        category: 'topup',
                        amount,
                        balanceBefore,
                        balanceAfter,
                        description: `Wallet Top-up via ${paymentMethod || 'payment gateway'}`,
                        paymentMethod,
                        paymentDetails,
                        status: 'completed',
                        referenceId: paymentDetails.payment_id || paymentDetails.order_id,
                        referenceType: 'payment'
                    });
                })
                .then(function(txn) {
                    if (!txn || !txn.insertId) throw new Error('Failed to create transaction record');
                    return { transactionId: txn.insertId, newBalance: balanceAfter };
                });
        });
}
