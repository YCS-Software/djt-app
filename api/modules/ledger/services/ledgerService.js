/**
 * Ledger Service — the reusable double-entry engine.
 *
 * `postJournal()` is the single primitive every money movement goes through:
 *   - opens (or joins) a DB transaction
 *   - is idempotent (by idempotency key)
 *   - locks the touched accounts (SELECT ... FOR UPDATE)
 *   - validates the entry is balanced (Σ debits == Σ credits, to the paise)
 *   - rejects overdraw on non-system accounts (INSUFFICIENT_FUNDS)
 *   - writes the journal header + legs, updates cached balances
 *   - keeps the legacy wallet (wllt_lst_t / trxn_lst_t) in sync
 *   - writes an audit row
 *
 * The higher-level flows (walletTopup, chargingHold, chargingSettle, chargingCancel,
 * payout) are thin compositions of postJournal and can be reused by any controller.
 */

const mdl = require('../models/ledgerMdl');

/* ----------------------------- money helpers ----------------------------- */

const toPaise = (rupees) => Math.round(Number(rupees) * 100);
const toRupees = (paise) => Math.round(paise) / 100;

let _seq = 0;
function genJrnlCd(type) {
    _seq = (_seq + 1) % 100000;
    const rand = Math.floor(Math.random() * 1e6).toString(36);
    return `JRN-${Date.now().toString(36)}-${_seq}-${rand}`.toUpperCase();
}

/** Map a journal type to the legacy trxn_lst_t category. */
function mapCategory(type) {
    switch (type) {
        case 'wallet_topup': return 'topup';
        case 'charging_hold':
        case 'charging_payment': return 'charging';
        case 'charging_refund': return 'refund';
        case 'payout': return 'transfer';
        default: return 'adjustment';
    }
}

/**
 * Split a consumed amount into owner / platform shares using integer paise and a
 * deterministic largest-remainder rule (platform absorbs the rounding remainder),
 * so owner + platform == total EXACTLY (no drift).
 */
function splitConsumed(consumedRupees, ownerPct, platformPct) {
    const totalP = toPaise(consumedRupees);
    const ownerP = Math.floor((totalP * ownerPct) / (ownerPct + platformPct));
    const platformP = totalP - ownerP; // remainder to platform
    return { ownerAmount: toRupees(ownerP), platformAmount: toRupees(platformP) };
}

/* ------------------------------- postJournal ----------------------------- */

/**
 * @param {Object} opts
 *   type            jrnl_typ_cd
 *   refType,refId   reference link (e.g. 'session', 42)
 *   description
 *   idempotencyKey  unique; a repeat returns the existing journal (no double post)
 *   actorUserId
 *   metadata        object -> mtdata_json
 *   legs            [{ acctId, direction:'debit'|'credit', amount, memo }]
 *   audit           { actnCd, userId, ip, userAgent }  (optional)
 *   walletPaymentMethod / walletPaymentDetails  (optional, for trxn mirror)
 * @param {Object} [externalConn]  reuse an existing txn connection (compose multiple journals atomically)
 */
async function postJournal(opts, externalConn) {
    const run = async (conn) => {
        // ---- idempotency ----
        if (opts.idempotencyKey) {
            const existing = await mdl.findJournalByIdempotency(conn, opts.idempotencyKey);
            if (existing) {
                return {
                    jrnlId: existing.jrnl_id, jrnlCd: existing.jrnl_cd,
                    totalAmt: parseFloat(existing.ttl_amt), idempotent: true, legs: []
                };
            }
        }

        // ---- validate balanced (paise) ----
        if (!Array.isArray(opts.legs) || opts.legs.length < 2) {
            throw { err_status: 400, err_message: 'A journal needs at least two legs' };
        }
        let debitP = 0, creditP = 0;
        for (const leg of opts.legs) {
            const p = toPaise(leg.amount);
            if (!(p > 0)) throw { err_status: 400, err_message: 'Leg amount must be > 0' };
            if (leg.direction === 'debit') debitP += p;
            else if (leg.direction === 'credit') creditP += p;
            else throw { err_status: 400, err_message: `Invalid leg direction: ${leg.direction}` };
        }
        if (debitP !== creditP) {
            throw { err_status: 400, err_message: `Journal not balanced: debit ${debitP}p != credit ${creditP}p` };
        }
        const totalAmt = toRupees(creditP);

        // ---- lock accounts (deterministic order to avoid deadlock) ----
        const acctIds = [...new Set(opts.legs.map(l => l.acctId))].sort((a, b) => a - b);
        const acctMap = {};
        for (const id of acctIds) {
            const acc = await mdl.getAccountForUpdate(conn, id);
            if (!acc) throw { err_status: 400, err_message: `Account not found: ${id}` };
            acctMap[id] = acc;
        }

        // ---- header ----
        const jrnlCd = genJrnlCd(opts.type);
        const jrnlId = await mdl.insertJournal(conn, {
            jrnlCd, type: opts.type, refType: opts.refType, refId: opts.refId,
            totalAmt, status: 'posted', idempotencyKey: opts.idempotencyKey,
            description: opts.description, metadata: opts.metadata, actorUserId: opts.actorUserId,
            reversalOfJrnlId: opts.reversalOfJrnlId,
        });

        // ---- legs ----
        const legResults = [];
        for (const leg of opts.legs) {
            const acc = acctMap[leg.acctId];
            const deltaP = (leg.direction === 'credit' ? 1 : -1) * toPaise(leg.amount);
            const beforeP = toPaise(acc.blnce_amt);
            const afterP = beforeP + deltaP;

            if (afterP < 0 && acc.is_systm_in !== 1) {
                throw {
                    err_status: 400, code: 'INSUFFICIENT_FUNDS',
                    err_message: `INSUFFICIENT_FUNDS in ${acc.acct_cd}: balance ${toRupees(beforeP)} cannot cover debit ${leg.amount}`
                };
            }

            const balanceAfter = toRupees(afterP);
            await mdl.insertLeg(conn, {
                jrnlId, acctId: acc.acct_id, direction: leg.direction,
                amount: leg.amount, balanceAfter, memo: leg.memo
            });
            await mdl.updateAccountBalance(conn, acc.acct_id, balanceAfter);
            acc.blnce_amt = balanceAfter; // keep in-memory copy fresh if account repeats

            // keep the legacy wallet view in sync for customer wallets — apply the
            // signed delta (increment/decrement), never an absolute overwrite.
            if (acc.acct_typ_cd === 'customer_wallet' && acc.usr_id) {
                const deltaRupees = (leg.direction === 'credit' ? 1 : -1) * leg.amount;
                const walletId = await mdl.applyWalletDelta(conn, acc.usr_id, deltaRupees);
                await mdl.insertWalletTxnMirror(conn, {
                    walletId, userId: acc.usr_id,
                    type: opts.type === 'charging_refund' ? 'refund' : leg.direction,
                    category: mapCategory(opts.type),
                    amount: leg.amount, balanceBefore: toRupees(beforeP), balanceAfter,
                    description: opts.description, refId: opts.refId, refType: opts.refType,
                    paymentMethod: opts.walletPaymentMethod,
                    paymentDetails: opts.walletPaymentDetails,
                });
            }

            legResults.push({
                acctId: acc.acct_id, acctCd: acc.acct_cd, acctTyp: acc.acct_typ_cd,
                direction: leg.direction, amount: leg.amount, balanceAfter
            });
        }

        // ---- audit ----
        if (opts.audit) {
            await mdl.insertAudit(conn, {
                userId: opts.audit.userId ?? opts.actorUserId,
                actnCd: opts.audit.actnCd || opts.type,
                enttyTypCd: 'journal', enttyId: jrnlId,
                newVal: { jrnlCd, type: opts.type, totalAmt, legs: legResults },
                ip: opts.audit.ip, userAgent: opts.audit.userAgent,
            });
        }

        return { jrnlId, jrnlCd, totalAmt, legs: legResults, idempotent: false };
    };

    return externalConn ? run(externalConn) : mdl.withTransaction(run);
}

/* ------------------------------- flows ----------------------------------- */

/**
 * Wallet top-up: money enters from the gateway and credits the user's wallet.
 *   DEBIT GATEWAY_RZP  /  CREDIT WALLET_<user>
 */
async function walletTopup({ userId, amount, paymentMethod = 'upi', paymentDetails = null, idempotencyKey, refType = 'pay_order', refId = null, audit }) {
    if (!(Number(amount) > 0)) throw { err_status: 400, err_message: 'Top-up amount must be > 0' };
    return mdl.withTransaction(async (conn) => {
        const gateway = await mdl.getSystemAccount(conn, 'GATEWAY_RZP');
        const wallet = await mdl.getCustomerWalletAccount(conn, userId);
        return postJournal({
            type: 'wallet_topup', refType, refId, idempotencyKey, actorUserId: userId,
            description: `Wallet top-up via ${paymentMethod}`,
            walletPaymentMethod: paymentMethod, walletPaymentDetails: paymentDetails,
            audit: audit || { actnCd: 'wallet_topup', userId },
            legs: [
                { acctId: gateway.acct_id, direction: 'debit', amount, memo: 'Gateway inflow' },
                { acctId: wallet.acct_id, direction: 'credit', amount, memo: 'Wallet credit' },
            ],
        }, conn);
    });
}

/**
 * Charging hold (prepay at session start): move funds from wallet into escrow.
 *   DEBIT WALLET_<user>  /  CREDIT ESCROW_HOLD
 * Throws INSUFFICIENT_FUNDS if the wallet cannot cover the hold.
 */
async function chargingHold({ userId, sessionId, amount, idempotencyKey, audit }) {
    if (!(Number(amount) > 0)) throw { err_status: 400, err_message: 'Hold amount must be > 0' };
    return mdl.withTransaction(async (conn) => {
        const wallet = await mdl.getCustomerWalletAccount(conn, userId);
        const escrow = await mdl.getSystemAccount(conn, 'ESCROW_HOLD');
        return postJournal({
            type: 'charging_hold', refType: 'session', refId: sessionId,
            idempotencyKey: idempotencyKey || `hold:session:${sessionId}`, actorUserId: userId,
            description: `Charging prepayment hold (session ${sessionId})`,
            walletPaymentMethod: 'wallet',
            audit: audit || { actnCd: 'charging_hold', userId },
            legs: [
                { acctId: wallet.acct_id, direction: 'debit', amount, memo: 'Prepay hold' },
                { acctId: escrow.acct_id, direction: 'credit', amount, memo: 'Escrow hold' },
            ],
        }, conn);
    });
}

/**
 * Charging settle (at session stop). Splits the CONSUMED amount between the station
 * owner and the platform, and refunds the unused remainder back to the wallet.
 * All postings happen in ONE DB transaction.
 *
 *   payment journal:  DEBIT ESCROW  / CREDIT OWNER (share) / CREDIT PLATFORM (share)
 *   refund journal:   DEBIT ESCROW  / CREDIT WALLET (unused)      [only if unused > 0]
 *
 * Platform-owned station (ownerUserId null) -> owner share is credited to PLATFORM_REVENUE.
 */
async function chargingSettle({ userId, sessionId, stationId, ownerUserId = null, holdAmount, consumedAmount, idempotencyKey, audit }) {
    const hold = toPaise(holdAmount);
    let consumed = toPaise(consumedAmount);
    if (consumed < 0) consumed = 0;
    if (consumed > hold) consumed = hold;       // prepaid model: never settle more than held
    const refund = hold - consumed;

    return mdl.withTransaction(async (conn) => {
        const escrow = await mdl.getSystemAccount(conn, 'ESCROW_HOLD');
        const platform = await mdl.getSystemAccount(conn, 'PLATFORM_REVENUE');
        const wallet = await mdl.getCustomerWalletAccount(conn, userId);
        const ownerAcct = ownerUserId
            ? await mdl.getOwnerAccount(conn, ownerUserId)
            : platform; // platform-owned station

        const rule = await mdl.resolveCommissionRule(conn, { stationId, ownerUserId });
        const results = { commission: rule, payment: null, refund: null };

        if (consumed > 0) {
            const { ownerAmount, platformAmount } = splitConsumed(toRupees(consumed), rule.ownerPct, rule.platformPct);
            const legs = [
                { acctId: escrow.acct_id, direction: 'debit', amount: toRupees(consumed), memo: 'Escrow settle' },
            ];
            // Owner + platform credits. If platform-owned, both land on PLATFORM_REVENUE.
            if (ownerAmount > 0) legs.push({ acctId: ownerAcct.acct_id, direction: 'credit', amount: ownerAmount, memo: `Owner ${rule.ownerPct}%` });
            if (platformAmount > 0) legs.push({ acctId: platform.acct_id, direction: 'credit', amount: platformAmount, memo: `Platform ${rule.platformPct}%` });
            results.payment = await postJournal({
                type: 'charging_payment', refType: 'session', refId: sessionId,
                idempotencyKey: (idempotencyKey || `settle:session:${sessionId}`) + ':pay', actorUserId: userId,
                description: `Charging settlement (session ${sessionId})`,
                metadata: { ownerUserId, stationId, ownerAmount, platformAmount, rule },
                audit: audit || { actnCd: 'charging_payment', userId },
                legs,
            }, conn);
        }

        if (refund > 0) {
            results.refund = await postJournal({
                type: 'charging_refund', refType: 'session', refId: sessionId,
                idempotencyKey: (idempotencyKey || `settle:session:${sessionId}`) + ':refund', actorUserId: userId,
                description: `Unused charging refund (session ${sessionId})`,
                walletPaymentMethod: 'wallet',
                audit: audit || { actnCd: 'charging_refund', userId },
                legs: [
                    { acctId: escrow.acct_id, direction: 'debit', amount: toRupees(refund), memo: 'Escrow refund' },
                    { acctId: wallet.acct_id, direction: 'credit', amount: toRupees(refund), memo: 'Unused refund' },
                ],
            }, conn);
        }

        return { ...results, consumedAmount: toRupees(consumed), refundAmount: toRupees(refund) };
    });
}

/**
 * Cancel a held session before/without consumption: refund the entire hold to the wallet.
 *   DEBIT ESCROW  /  CREDIT WALLET_<user>
 */
async function chargingCancel({ userId, sessionId, holdAmount, idempotencyKey, audit }) {
    if (!(Number(holdAmount) > 0)) return { skipped: true, reason: 'nothing_held' };
    return mdl.withTransaction(async (conn) => {
        const escrow = await mdl.getSystemAccount(conn, 'ESCROW_HOLD');
        const wallet = await mdl.getCustomerWalletAccount(conn, userId);
        return postJournal({
            type: 'charging_refund', refType: 'session', refId: sessionId,
            idempotencyKey: idempotencyKey || `cancel:session:${sessionId}`, actorUserId: userId,
            description: `Charging cancelled — full refund (session ${sessionId})`,
            walletPaymentMethod: 'wallet',
            audit: audit || { actnCd: 'charging_refund', userId },
            legs: [
                { acctId: escrow.acct_id, direction: 'debit', amount: holdAmount, memo: 'Escrow release' },
                { acctId: wallet.acct_id, direction: 'credit', amount: holdAmount, memo: 'Full refund' },
            ],
        }, conn);
    });
}

/**
 * Pay an owner out (money leaves to bank): reduce owner earnings, decrease gateway clearing.
 *   DEBIT OWNER_<owner>  /  CREDIT GATEWAY_RZP
 */
async function payout({ ownerUserId, amount, idempotencyKey, audit }) {
    if (!(Number(amount) > 0)) throw { err_status: 400, err_message: 'Payout amount must be > 0' };
    return mdl.withTransaction(async (conn) => {
        const ownerAcct = await mdl.getOwnerAccount(conn, ownerUserId);
        const gateway = await mdl.getSystemAccount(conn, 'GATEWAY_RZP');
        return postJournal({
            type: 'payout', refType: 'settlement', refId: null,
            idempotencyKey, actorUserId: ownerUserId,
            description: `Owner payout`,
            audit: audit || { actnCd: 'payout', userId: ownerUserId },
            legs: [
                { acctId: ownerAcct.acct_id, direction: 'debit', amount, memo: 'Payout' },
                { acctId: gateway.acct_id, direction: 'credit', amount, memo: 'Bank transfer' },
            ],
        }, conn);
    });
}

/* ------------------------------- reads ----------------------------------- */

async function getWalletBalance(userId) {
    const acc = await mdl.getAccountByCodePooled(`WALLET_${userId}`);
    return acc ? parseFloat(acc.blnce_amt) : 0;
}

async function getOwnerBalance(ownerUserId) {
    const acc = await mdl.getAccountByCodePooled(`OWNER_${ownerUserId}`);
    return acc ? parseFloat(acc.blnce_amt) : 0;
}

module.exports = {
    // engine
    postJournal,
    // flows
    walletTopup, chargingHold, chargingSettle, chargingCancel, payout,
    // reads
    getWalletBalance, getOwnerBalance,
    // helpers (exported for tests/reuse)
    splitConsumed, toPaise, toRupees,
};
