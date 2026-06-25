/**
 * Web Transactions Model
 * Admin web console (djt-web) — wallet & payment transactions.
 * Read-only SELECTs only against the live `*_lst_t` schema.
 */

const sqldb = require(appRoot + '/config/db.config');
const dbutil = require(appRoot + '/utils/db.utils');
const cntxtDtls = "transactionsMdl";

/*****************************************************************************
* Function      : listMdl
* Description   : All wallet/payment transactions with the associated user.
******************************************************************************/
exports.listMdl = function() {
    const QRY_TO_EXEC = `SELECT t.trxn_id AS id, u.nm_tx AS user, t.trxn_typ_cd AS type, t.trxn_ctgry_cd AS category, t.amt AS amount, t.blnce_aftr_amt AS balanceAfter, t.pymnt_mthd_cd AS method, t.sttus_cd AS status, t.i_ts AS createdAt FROM trxn_lst_t t LEFT JOIN usr_lst_t u ON u.usr_id=t.usr_id ORDER BY t.trxn_id DESC`;

    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, [], cntxtDtls);
};

/*****************************************************************************
* Function      : getByIdMdl
* Description   : Single transaction by primary id (list select wrapped).
* Arguments     : data object with id
******************************************************************************/
exports.getByIdMdl = function(data) {
    const id = parseInt(data.id, 10) || 0;
    const QRY_TO_EXEC = `SELECT * FROM ( SELECT t.trxn_id AS id, u.nm_tx AS user, t.trxn_typ_cd AS type, t.trxn_ctgry_cd AS category, t.amt AS amount, t.blnce_aftr_amt AS balanceAfter, t.pymnt_mthd_cd AS method, t.sttus_cd AS status, t.i_ts AS createdAt FROM trxn_lst_t t LEFT JOIN usr_lst_t u ON u.usr_id=t.usr_id ORDER BY t.trxn_id DESC ) q WHERE q.id = ?`;

    const PARAMS = [id];
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};
