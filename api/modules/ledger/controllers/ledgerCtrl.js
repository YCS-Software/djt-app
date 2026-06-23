/**
 * Ledger Controller
 * HTTP surface for the ledger: a user's accounts & statements, a journal view,
 * and the Razorpay webhook (server-to-server, signature verified, idempotent).
 */

const std = require(appRoot + '/utils/standardMessages');
const df = require(appRoot + '/utils/dateFormatUtil');
const rzp = require(appRoot + '/config/razorpay.config');
const mdl = require('../models/ledgerMdl');
const ledger = require('../services/ledgerService');
const cntxtDtls = 'ledgerCtrl';

function badRequest(res, message) {
    return res.status(std.message['BAD_REQUEST'].code).json({
        status: std.message['BAD_REQUEST'].code, message, data: null
    });
}

/* GET /api/ledger/accounts — the caller's own ledger accounts (wallet + owner) */
exports.getMyAccounts = async function (req, res) {
    const fnm = 'getMyAccounts';
    try {
        const accounts = await mdl.getAccountsForUser(req.user.userId);
        return df.formatSucessRes(req, res, {
            accounts: accounts.map(a => ({
                account_id: a.acct_id, account_code: a.acct_cd, type: a.acct_typ_cd,
                balance: parseFloat(a.blnce_amt), currency: a.crncy_cd
            }))
        }, cntxtDtls, fnm, {});
    } catch (e) {
        return df.formatErrorRes(res, e, cntxtDtls, fnm, {});
    }
};

/* GET /api/ledger/accounts/:acctId/statement — transaction history for one account */
exports.getAccountStatement = async function (req, res) {
    const fnm = 'getAccountStatement';
    try {
        const acctId = parseInt(req.params.acctId, 10);
        if (!acctId) return badRequest(res, 'Invalid account id');

        const acc = await mdl.getAccountByCodePooled(`WALLET_${req.user.userId}`); // touch to validate user exists
        // Ownership / authorization check
        const all = await mdl.getAccountsForUser(req.user.userId);
        const owns = all.some(a => a.acct_id === acctId);
        const isAdmin = req.user.userType === 'admin';
        if (!owns && !isAdmin) {
            return res.status(std.message['FORBIDDEN'].code).json({
                status: std.message['FORBIDDEN'].code, message: 'Not your account', data: null
            });
        }

        const limit = parseInt(req.query.limit, 10) || 50;
        const offset = parseInt(req.query.offset, 10) || 0;
        const rows = await mdl.getAccountStatement(acctId, limit, offset);
        return df.formatSucessRes(req, res, {
            account_id: acctId,
            entries: rows.map(r => ({
                leg_id: r.leg_id, direction: r.drct_cd, amount: parseFloat(r.amt),
                balance_after: parseFloat(r.blnce_aftr_amt), memo: r.memo_tx,
                journal_code: r.jrnl_cd, journal_type: r.jrnl_typ_cd,
                ref_type: r.ref_typ_cd, ref_id: r.ref_id,
                description: r.dscrptn_tx, timestamp: df.formatDate(r.i_ts)
            }))
        }, cntxtDtls, fnm, {});
    } catch (e) {
        return df.formatErrorRes(res, e, cntxtDtls, fnm, {});
    }
};

/* GET /api/ledger/journals/:jrnlId — one journal entry with all its legs */
exports.getJournal = async function (req, res) {
    const fnm = 'getJournal';
    try {
        const jrnlId = parseInt(req.params.jrnlId, 10);
        if (!jrnlId) return badRequest(res, 'Invalid journal id');
        const data = await mdl.getJournalWithLegs(jrnlId);
        if (!data) {
            return res.status(std.message['NOT_FOUND'].code).json({
                status: std.message['NOT_FOUND'].code, message: 'Journal not found', data: null
            });
        }
        // Authorization: admin, or the user must be party to one of the legs.
        const isAdmin = req.user.userType === 'admin';
        const myAccts = (await mdl.getAccountsForUser(req.user.userId)).map(a => a.acct_id);
        const involved = data.legs.some(l => myAccts.includes(l.acct_id));
        if (!isAdmin && !involved) {
            return res.status(std.message['FORBIDDEN'].code).json({
                status: std.message['FORBIDDEN'].code, message: 'Not authorized for this journal', data: null
            });
        }
        return df.formatSucessRes(req, res, {
            journal: {
                journal_id: data.journal.jrnl_id, journal_code: data.journal.jrnl_cd,
                type: data.journal.jrnl_typ_cd, total: parseFloat(data.journal.ttl_amt),
                ref_type: data.journal.ref_typ_cd, ref_id: data.journal.ref_id,
                status: data.journal.sttus_cd, description: data.journal.dscrptn_tx,
                timestamp: df.formatDate(data.journal.i_ts)
            },
            legs: data.legs.map(l => ({
                leg_id: l.leg_id, account_code: l.acct_cd, account_type: l.acct_typ_cd,
                direction: l.drct_cd, amount: parseFloat(l.amt), balance_after: parseFloat(l.blnce_aftr_amt),
                memo: l.memo_tx
            }))
        }, cntxtDtls, fnm, {});
    } catch (e) {
        return df.formatErrorRes(res, e, cntxtDtls, fnm, {});
    }
};

/**
 * POST /api/ledger/webhook/razorpay  (PUBLIC, no JWT)
 * Verifies signature, records the event idempotently, and reconciles wallet top-ups
 * for captured payments that were not finalised by the synchronous /payment/verify call.
 */
exports.razorpayWebhook = async function (req, res) {
    const fnm = 'razorpayWebhook';
    try {
        const signature = req.headers['x-razorpay-signature'];
        const eventId = req.headers['x-razorpay-event-id'] || `evt_${Date.now()}`;
        const raw = req.rawBody || JSON.stringify(req.body || {});

        const signatureValid = rzp.isWebhookConfigured()
            ? rzp.verifyWebhookSignature(raw, signature)
            : false;

        // If a secret is configured we MUST reject bad signatures.
        if (rzp.isWebhookConfigured() && !signatureValid) {
            return res.status(std.message['UNAUTHORIZED'].code).json({
                status: std.message['UNAUTHORIZED'].code, message: 'Invalid webhook signature', data: null
            });
        }

        const body = req.body || {};
        const eventType = body.event;
        const paymentEntity = body.payload && body.payload.payment && body.payload.payment.entity;

        const result = await mdl.withTransaction(async (conn) => {
            // Idempotency by Razorpay event id.
            const existing = await mdl.findWebhookByEventId(conn, eventId);
            if (existing && existing.prcsd_in === 1) {
                return { already: true };
            }
            const wbhkId = existing
                ? existing.wbhk_id
                : await mdl.insertWebhookEvent(conn, {
                    eventId, eventType,
                    orderId: paymentEntity && paymentEntity.order_id,
                    paymentId: paymentEntity && paymentEntity.id,
                    signatureValid, payload: body
                });

            // Reconcile only verified, captured wallet top-ups.
            if (signatureValid && eventType === 'payment.captured' && paymentEntity) {
                const order = await mdl.getPayOrderByRzpOrderId(conn, paymentEntity.order_id);
                if (order && order.sttus_cd !== 'paid' && (order.purpose_cd || 'wallet_topup') === 'wallet_topup') {
                    const amount = (paymentEntity.amount || order.amt * 100) / 100;
                    const jr = await ledger.postJournal({
                        type: 'wallet_topup', refType: 'pay_order', refId: order.pay_ordr_id,
                        idempotencyKey: `topup:order:${order.pay_ordr_id}`, actorUserId: order.usr_id,
                        description: 'Wallet top-up (webhook reconciled)',
                        walletPaymentMethod: order.pymnt_mthd_cd || 'upi',
                        walletPaymentDetails: { order_id: paymentEntity.order_id, payment_id: paymentEntity.id, via: 'webhook' },
                        audit: { actnCd: 'wallet_topup', userId: order.usr_id },
                        legs: [
                            { acctId: (await mdl.getSystemAccount(conn, 'GATEWAY_RZP')).acct_id, direction: 'debit', amount },
                            { acctId: (await mdl.getCustomerWalletAccount(conn, order.usr_id)).acct_id, direction: 'credit', amount },
                        ],
                    }, conn);
                    await mdl.markPayOrderPaid(conn, { payOrderId: order.pay_ordr_id, paymentId: paymentEntity.id, jrnlId: jr.jrnlId });
                }
            }

            await mdl.markWebhookProcessed(conn, wbhkId);
            return { processed: true };
        });

        // Always 200 quickly so Razorpay does not retry a handled event.
        return res.status(200).json({ status: 200, message: 'ok', data: result });
    } catch (e) {
        console.error('[ledgerCtrl] webhook error:', e);
        // 200 to avoid infinite retries on our internal errors; the event row persists for replay.
        return res.status(200).json({ status: 200, message: 'received', data: null });
    }
};
