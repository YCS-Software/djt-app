/**
 * Ledger Model
 * All database operations for the double-entry ledger: accounts, journal entries,
 * journal legs, commission rules, gateway-webhook log, plus the legacy wallet
 * cache sync (wllt_lst_t / trxn_lst_t).
 *
 * Every write here is connection-aware: callers pass a mysql2 connection that is
 * already inside a transaction, so the whole money movement commits or rolls back
 * atomically. Use `withTransaction()` to get such a connection.
 *
 * All queries are PARAMETERIZED (no string concatenation of values).
 */

const sqldb = require(appRoot + '/config/db.config');
const pool = sqldb.pool;

/* ------------------------------------------------------------------ *
 * Transaction helper
 * ------------------------------------------------------------------ */

/**
 * Run `fn(conn)` inside a single DB transaction. Commits on success,
 * rolls back on any throw, always releases the connection.
 */
async function withTransaction(fn) {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const result = await fn(conn);
        await conn.commit();
        return result;
    } catch (err) {
        try { await conn.rollback(); } catch (_) { /* ignore */ }
        throw err;
    } finally {
        conn.release();
    }
}

/* ------------------------------------------------------------------ *
 * Accounts
 * ------------------------------------------------------------------ */

/** Lock and return an account row by id (SELECT ... FOR UPDATE). */
async function getAccountForUpdate(conn, acctId) {
    const [rows] = await conn.execute(
        `SELECT * FROM acct_lst_t WHERE acct_id = ? FOR UPDATE`, [acctId]);
    return rows[0] || null;
}

async function getAccountByCode(conn, acctCd) {
    const [rows] = await conn.execute(
        `SELECT * FROM acct_lst_t WHERE acct_cd = ? LIMIT 1`, [acctCd]);
    return rows[0] || null;
}

async function getAccountById(conn, acctId) {
    const [rows] = await conn.execute(
        `SELECT * FROM acct_lst_t WHERE acct_id = ? LIMIT 1`, [acctId]);
    return rows[0] || null;
}

/** Create an account if missing (by unique acct_cd), returning the row. */
async function ensureAccount(conn, { acctCd, acctTypCd, usrId = null, ownrUsrId = null, sttnId = null, isSystem = 0 }) {
    const existing = await getAccountByCode(conn, acctCd);
    if (existing) return existing;
    await conn.execute(
        `INSERT INTO acct_lst_t (acct_cd, acct_typ_cd, usr_id, ownr_usr_id, sttn_id, crncy_cd, blnce_amt, is_systm_in, a_in)
         VALUES (?, ?, ?, ?, ?, 'INR', 0.00, ?, 1)`,
        [acctCd, acctTypCd, usrId, ownrUsrId, sttnId, isSystem]
    );
    return getAccountByCode(conn, acctCd);
}

async function getCustomerWalletAccount(conn, userId) {
    return ensureAccount(conn, { acctCd: `WALLET_${userId}`, acctTypCd: 'customer_wallet', usrId: userId });
}

async function getOwnerAccount(conn, ownerUserId) {
    return ensureAccount(conn, { acctCd: `OWNER_${ownerUserId}`, acctTypCd: 'owner_earnings', ownrUsrId: ownerUserId });
}

async function getSystemAccount(conn, acctCd) {
    const acc = await getAccountByCode(conn, acctCd);
    if (!acc) throw { err_status: 500, err_message: `System account missing: ${acctCd} (run migration)` };
    return acc;
}

async function updateAccountBalance(conn, acctId, newBalance) {
    await conn.execute(
        `UPDATE acct_lst_t SET blnce_amt = ?, u_ts = NOW() WHERE acct_id = ?`,
        [newBalance, acctId]);
}

/* ------------------------------------------------------------------ *
 * Journals + legs
 * ------------------------------------------------------------------ */

async function findJournalByIdempotency(conn, idempotencyKey) {
    if (!idempotencyKey) return null;
    const [rows] = await conn.execute(
        `SELECT * FROM jrnl_lst_t WHERE idmpncy_ky_tx = ? LIMIT 1`, [idempotencyKey]);
    return rows[0] || null;
}

async function insertJournal(conn, j) {
    const [res] = await conn.execute(
        `INSERT INTO jrnl_lst_t
            (jrnl_cd, jrnl_typ_cd, ref_typ_cd, ref_id, ttl_amt, crncy_cd, sttus_cd,
             rvrsl_of_jrnl_id, idmpncy_ky_tx, dscrptn_tx, mtdata_json, insrt_usr_id, a_in)
         VALUES (?, ?, ?, ?, ?, 'INR', ?, ?, ?, ?, ?, ?, 1)`,
        [
            j.jrnlCd, j.type, j.refType ?? null, j.refId ?? null, j.totalAmt,
            j.status || 'posted', j.reversalOfJrnlId ?? null, j.idempotencyKey ?? null,
            j.description ?? null, j.metadata ? JSON.stringify(j.metadata) : null,
            j.actorUserId ?? null
        ]);
    return res.insertId;
}

async function insertLeg(conn, leg) {
    await conn.execute(
        `INSERT INTO jrnl_leg_lst_t (jrnl_id, acct_id, drct_cd, amt, blnce_aftr_amt, memo_tx)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [leg.jrnlId, leg.acctId, leg.direction, leg.amount, leg.balanceAfter, leg.memo ?? null]);
}

async function getJournalById(conn, jrnlId) {
    const [rows] = await conn.execute(`SELECT * FROM jrnl_lst_t WHERE jrnl_id = ? LIMIT 1`, [jrnlId]);
    return rows[0] || null;
}

/* ------------------------------------------------------------------ *
 * Commission rule resolution (station > owner > global, effective-dated)
 * ------------------------------------------------------------------ */

async function resolveCommissionRule(conn, { stationId = null, ownerUserId = null }) {
    const [rows] = await conn.execute(
        `SELECT * FROM cmsn_rule_lst_t
          WHERE a_in = 1
            AND eff_frm_ts <= NOW()
            AND (eff_to_ts IS NULL OR eff_to_ts >= NOW())
            AND (
                  (scope_cd = 'station' AND sttn_id = ?)
               OR (scope_cd = 'owner'   AND ownr_usr_id = ?)
               OR (scope_cd = 'global')
            )
          ORDER BY FIELD(scope_cd, 'station', 'owner', 'global'), prirty_nbr DESC, rule_id DESC
          LIMIT 1`,
        [stationId, ownerUserId]
    );
    if (rows[0]) {
        return {
            ownerPct: parseFloat(rows[0].ownr_pct),
            platformPct: parseFloat(rows[0].platfrm_pct),
            taxPct: parseFloat(rows[0].tax_pct),
            ruleId: rows[0].rule_id,
            scope: rows[0].scope_cd,
        };
    }
    // Hard fallback if no rule seeded at all.
    return { ownerPct: 80, platformPct: 20, taxPct: 0, ruleId: null, scope: 'fallback' };
}

/* ------------------------------------------------------------------ *
 * Legacy wallet cache sync (keeps wllt_lst_t + trxn_lst_t in step with the ledger)
 * ------------------------------------------------------------------ */

async function getWalletByUser(conn, userId) {
    const [rows] = await conn.execute(
        `SELECT * FROM wllt_lst_t WHERE usr_id = ? LIMIT 1`, [userId]);
    return rows[0] || null;
}

/**
 * Apply a SIGNED DELTA to the cached wallet balance (increment for credits,
 * decrement for debits) — never an absolute overwrite, so it cannot clobber a
 * balance written by another code path. Creates the wallet row if missing.
 * Returns wllt_id.
 */
async function applyWalletDelta(conn, userId, deltaAmount) {
    const wallet = await getWalletByUser(conn, userId);
    if (wallet) {
        await conn.execute(
            `UPDATE wllt_lst_t SET blnce_amt = blnce_amt + ?, lst_updtd_ts = NOW() WHERE wllt_id = ?`,
            [deltaAmount, wallet.wllt_id]);
        return wallet.wllt_id;
    }
    const [res] = await conn.execute(
        `INSERT INTO wllt_lst_t (usr_id, blnce_amt, a_in) VALUES (?, ?, 1)`,
        [userId, deltaAmount > 0 ? deltaAmount : 0]);
    return res.insertId;
}

/** Mirror a customer-wallet leg into the legacy trxn_lst_t statement table. */
async function insertWalletTxnMirror(conn, t) {
    await conn.execute(
        `INSERT INTO trxn_lst_t
            (wllt_id, usr_id, trxn_typ_cd, trxn_ctgry_cd, amt, blnce_bfr_amt, blnce_aftr_amt,
             dscrptn_tx, ref_id, ref_typ_cd, pymnt_mthd_cd, pymnt_dtls_json, sttus_cd, a_in)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', 1)`,
        [
            t.walletId, t.userId, t.type, t.category, t.amount, t.balanceBefore, t.balanceAfter,
            t.description ?? null, t.refId != null ? String(t.refId) : null, t.refType ?? null,
            t.paymentMethod ?? null, t.paymentDetails ? JSON.stringify(t.paymentDetails) : null
        ]);
}

/* ------------------------------------------------------------------ *
 * Audit
 * ------------------------------------------------------------------ */

async function insertAudit(conn, a) {
    await conn.execute(
        `INSERT INTO audt_lst_t (usr_id, actn_cd, entty_typ_cd, entty_id, old_vl_json, nw_vl_json, ip_addr_tx, usr_agnt_tx)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            a.userId ?? null, a.actnCd, a.enttyTypCd ?? null, a.enttyId ?? null,
            a.oldVal ? JSON.stringify(a.oldVal) : null,
            a.newVal ? JSON.stringify(a.newVal) : null,
            a.ip ?? null, a.userAgent ?? null
        ]);
}

/* ------------------------------------------------------------------ *
 * Webhook log
 * ------------------------------------------------------------------ */

async function findWebhookByEventId(conn, eventId) {
    const [rows] = await conn.execute(
        `SELECT * FROM pay_wbhk_lst_t WHERE evnt_id_tx = ? LIMIT 1`, [eventId]);
    return rows[0] || null;
}

async function insertWebhookEvent(conn, w) {
    const [res] = await conn.execute(
        `INSERT INTO pay_wbhk_lst_t
            (evnt_id_tx, evnt_typ_tx, rzrpy_ordr_id_tx, rzrpy_pymnt_id_tx, sgntr_vld_in, prcsd_in, paylod_json)
         VALUES (?, ?, ?, ?, ?, 0, ?)`,
        [w.eventId, w.eventType ?? null, w.orderId ?? null, w.paymentId ?? null,
         w.signatureValid ? 1 : 0, w.payload ? JSON.stringify(w.payload) : null]);
    return res.insertId;
}

async function markWebhookProcessed(conn, wbhkId) {
    await conn.execute(
        `UPDATE pay_wbhk_lst_t SET prcsd_in = 1, prcsd_ts = NOW() WHERE wbhk_id = ?`, [wbhkId]);
}

/* ------------------------------------------------------------------ *
 * Payment orders (for webhook reconciliation)
 * ------------------------------------------------------------------ */

async function getPayOrderByRzpOrderId(conn, rzpOrderId) {
    const [rows] = await conn.execute(
        `SELECT * FROM pay_ordr_lst_t WHERE rzrpy_ordr_id_tx = ? LIMIT 1`, [rzpOrderId]);
    return rows[0] || null;
}

async function markPayOrderPaid(conn, { payOrderId, paymentId = null, jrnlId = null, trxnId = null }) {
    await conn.execute(
        `UPDATE pay_ordr_lst_t
            SET sttus_cd = 'paid', rzrpy_pymnt_id_tx = COALESCE(?, rzrpy_pymnt_id_tx),
                jrnl_id = COALESCE(?, jrnl_id), trxn_id = COALESCE(?, trxn_id), u_ts = NOW()
          WHERE pay_ordr_id = ?`,
        [paymentId, jrnlId, trxnId, payOrderId]);
}

/* ------------------------------------------------------------------ *
 * Read-side helpers (statements / balances) — pooled (no txn needed)
 * ------------------------------------------------------------------ */

async function getAccountByCodePooled(acctCd) {
    const [rows] = await pool.execute(`SELECT * FROM acct_lst_t WHERE acct_cd = ? LIMIT 1`, [acctCd]);
    return rows[0] || null;
}

async function getAccountsForUser(userId) {
    const [rows] = await pool.execute(
        `SELECT * FROM acct_lst_t WHERE usr_id = ? OR ownr_usr_id = ? ORDER BY acct_id`,
        [userId, userId]);
    return rows;
}

async function getAccountStatement(acctId, limit = 50, offset = 0) {
    const lim = Number.isFinite(+limit) ? +limit : 50;
    const off = Number.isFinite(+offset) ? +offset : 0;
    const [rows] = await pool.query(
        `SELECT l.leg_id, l.drct_cd, l.amt, l.blnce_aftr_amt, l.memo_tx, l.i_ts,
                j.jrnl_cd, j.jrnl_typ_cd, j.ref_typ_cd, j.ref_id, j.dscrptn_tx
           FROM jrnl_leg_lst_t l
           JOIN jrnl_lst_t j ON j.jrnl_id = l.jrnl_id
          WHERE l.acct_id = ?
          ORDER BY l.leg_id DESC
          LIMIT ${lim} OFFSET ${off}`,
        [acctId]);
    return rows;
}

async function getJournalWithLegs(jrnlId) {
    const [jrows] = await pool.execute(`SELECT * FROM jrnl_lst_t WHERE jrnl_id = ?`, [jrnlId]);
    if (!jrows[0]) return null;
    const [legs] = await pool.execute(
        `SELECT l.*, a.acct_cd, a.acct_typ_cd
           FROM jrnl_leg_lst_t l JOIN acct_lst_t a ON a.acct_id = l.acct_id
          WHERE l.jrnl_id = ? ORDER BY l.leg_id`, [jrnlId]);
    return { journal: jrows[0], legs };
}

module.exports = {
    pool,
    withTransaction,
    // accounts
    getAccountForUpdate, getAccountByCode, getAccountById, ensureAccount,
    getCustomerWalletAccount, getOwnerAccount, getSystemAccount, updateAccountBalance,
    // journals
    findJournalByIdempotency, insertJournal, insertLeg, getJournalById,
    // commission
    resolveCommissionRule,
    // wallet cache
    getWalletByUser, applyWalletDelta, insertWalletTxnMirror,
    // audit
    insertAudit,
    // webhook
    findWebhookByEventId, insertWebhookEvent, markWebhookProcessed,
    // pay orders
    getPayOrderByRzpOrderId, markPayOrderPaid,
    // read-side
    getAccountByCodePooled, getAccountsForUser, getAccountStatement, getJournalWithLegs,
};
