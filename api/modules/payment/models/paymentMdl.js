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

// Create an audit row when an order is created
exports.createOrderAuditMdl = function(data) {
    const QRY_TO_EXEC = `INSERT INTO pay_ordr_lst_t
        (usr_id, rzrpy_ordr_id_tx, amt, crncy_cd, purpose_cd, pymnt_mthd_cd, sttus_cd, is_mock_in, a_in, i_ts)
        VALUES
        (${num(data.userId)}, ${esc(data.orderId)}, ${num(data.amount, 0)}, ${esc(data.currency || 'INR')},
         ${esc(data.purpose || 'wallet_topup')}, ${esc(data.paymentMethod)}, 'created', ${data.isMock ? 1 : 0}, 1, NOW())`;

    console.log('[createOrderAuditMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};

// Look up an order by its Razorpay order id (scoped to the user)
exports.getOrderByRzpIdMdl = function(data) {
    const QRY_TO_EXEC = `SELECT * FROM pay_ordr_lst_t
        WHERE rzrpy_ordr_id_tx = ${esc(data.orderId)}
        AND usr_id = ${num(data.userId)}
        ORDER BY pay_ordr_id DESC
        LIMIT 1`;

    console.log('[getOrderByRzpIdMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};

// Mark an order paid + link to wallet transaction
exports.markOrderPaidMdl = function(data) {
    const QRY_TO_EXEC = `UPDATE pay_ordr_lst_t SET
        sttus_cd = 'paid',
        rzrpy_pymnt_id_tx = ${esc(data.paymentId)},
        rzrpy_sgntr_tx = ${esc(data.signature)},
        trxn_id = ${num(data.transactionId, 'NULL')},
        u_ts = NOW()
        WHERE pay_ordr_id = ${num(data.orderAuditId)}`;

    console.log('[markOrderPaidMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};

// Mark an order failed
exports.markOrderFailedMdl = function(data) {
    const QRY_TO_EXEC = `UPDATE pay_ordr_lst_t SET sttus_cd = 'failed', u_ts = NOW()
        WHERE pay_ordr_id = ${num(data.orderAuditId)}`;

    console.log('[markOrderFailedMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};
