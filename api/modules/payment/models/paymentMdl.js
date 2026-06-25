/**
 * Payment Model
 * Razorpay payment-order audit trail (pay_ordr_lst_t).
 */

const sqldb = require(appRoot + '/config/db.config');
const dbutil = require(appRoot + '/utils/db.utils');
const cntxtDtls = "paymentMdl";

function esc(v) {
    if (v === undefined || v === null || v === '') return 'NULL';
    return `'${String(v).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
}
function num(v, def) {
    const n = Number(v);
    return isNaN(n) ? (def === undefined ? 'NULL' : def) : n;
}

// --- bind-value helpers (parameterized equivalents of esc()/num()) ---
// escVal: null for undefined/null/empty-string, else the string value.
function escVal(v) {
    if (v === undefined || v === null || v === '') return null;
    return String(v);
}
// numVal: numeric value, or `def` when not a number. def 'NULL'/undefined -> JS null.
function numVal(v, def) {
    const n = Number(v);
    if (!isNaN(n)) return n;
    if (def === undefined || def === 'NULL') return null;
    return def;
}

// Create an audit row when an order is created
exports.createOrderAuditMdl = function(data) {
    const QRY_TO_EXEC = `INSERT INTO pay_ordr_lst_t
        (usr_id, rzrpy_ordr_id_tx, amt, crncy_cd, purpose_cd, pymnt_mthd_cd, sttus_cd, is_mock_in, a_in, i_ts)
        VALUES
        (?, ?, ?, ?,
         ?, ?, 'created', ?, 1, NOW())`;
    const PARAMS = [numVal(data.userId), escVal(data.orderId), numVal(data.amount, 0), escVal(data.currency || 'INR'),
        escVal(data.purpose || 'wallet_topup'), escVal(data.paymentMethod), data.isMock ? 1 : 0];

    console.log('[createOrderAuditMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

// Look up an order by its Razorpay order id (scoped to the user)
exports.getOrderByRzpIdMdl = function(data) {
    const QRY_TO_EXEC = `SELECT * FROM pay_ordr_lst_t
        WHERE rzrpy_ordr_id_tx = ?
        AND usr_id = ?
        ORDER BY pay_ordr_id DESC
        LIMIT 1`;
    const PARAMS = [escVal(data.orderId), numVal(data.userId)];

    console.log('[getOrderByRzpIdMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

// Mark an order paid + link to wallet transaction / ledger journal
exports.markOrderPaidMdl = function(data) {
    const QRY_TO_EXEC = `UPDATE pay_ordr_lst_t SET
        sttus_cd = 'paid',
        rzrpy_pymnt_id_tx = ?,
        rzrpy_sgntr_tx = ?,
        trxn_id = ?,
        jrnl_id = ?,
        u_ts = NOW()
        WHERE pay_ordr_id = ?`;
    const PARAMS = [escVal(data.paymentId), escVal(data.signature),
        numVal(data.transactionId, 'NULL'), numVal(data.jrnlId, 'NULL'),
        numVal(data.orderAuditId)];

    console.log('[markOrderPaidMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

// Mark an order failed
exports.markOrderFailedMdl = function(data) {
    const QRY_TO_EXEC = `UPDATE pay_ordr_lst_t SET sttus_cd = 'failed', u_ts = NOW()
        WHERE pay_ordr_id = ?`;
    const PARAMS = [numVal(data.orderAuditId)];

    console.log('[markOrderFailedMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};
