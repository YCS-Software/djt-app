/**
 * Drivers Model (web admin console)
 * Read-only SELECTs against the live `*_lst_t` schema. SELECT only.
 */

const sqldb = require(appRoot + '/config/db.config');
const dbutil = require(appRoot + '/utils/db.utils');
const cntxtDtls = "driversMdl";

/*****************************************************************************
* Function      : listMdl
* Description   : Registered EV drivers (customers) with wallet balances.
******************************************************************************/
exports.listMdl = function() {
    const QRY_TO_EXEC = `SELECT u.usr_id AS id, u.nm_tx AS name, u.eml_tx AS email, u.phn_nmbr_tx AS phone, COALESCE(w.blnce_amt,0) AS walletBalance, CASE WHEN u.a_in=1 THEN 'Active' ELSE 'Inactive' END AS status, u.i_ts AS createdAt FROM usr_lst_t u LEFT JOIN wllt_lst_t w ON w.usr_id=u.usr_id AND w.a_in=1 WHERE u.usr_typ_cd='customer' ORDER BY u.usr_id DESC`;

    console.log('[listMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};

/*****************************************************************************
* Function      : getByIdMdl
* Description   : Single driver detail filtered by primary id column.
* Arguments     : data object with id
******************************************************************************/
exports.getByIdMdl = function(data) {
    const id = parseInt(data.id, 10) || 0;
    const QRY_TO_EXEC = `SELECT * FROM ( SELECT u.usr_id AS id, u.nm_tx AS name, u.eml_tx AS email, u.phn_nmbr_tx AS phone, COALESCE(w.blnce_amt,0) AS walletBalance, CASE WHEN u.a_in=1 THEN 'Active' ELSE 'Inactive' END AS status, u.i_ts AS createdAt FROM usr_lst_t u LEFT JOIN wllt_lst_t w ON w.usr_id=u.usr_id AND w.a_in=1 WHERE u.usr_typ_cd='customer' ORDER BY u.usr_id DESC ) q WHERE q.id = ${id}`;

    console.log('[getByIdMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};
