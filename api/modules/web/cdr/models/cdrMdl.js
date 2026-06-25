/**
 * CDR Model (admin web console — djt-web)
 * Charge Detail Records derived from the live `sssn_lst_t` schema, joined to
 * station and user for display names. Read-only SELECTs only.
 */

const sqldb = require(appRoot + '/config/db.config');
const dbutil = require(appRoot + '/utils/db.utils');
const cntxtDtls = "cdrMdl";

/*****************************************************************************
* Function      : listMdl
* Description   : Charge detail records (one per charging session).
******************************************************************************/
exports.listMdl = function () {
    const QRY = `SELECT s.sssn_id AS cdrId, s.sssn_id AS sessionId, st.sttn_nm_tx AS stationName, u.nm_tx AS driverName, s.enrgy_cnsmd_kwh AS energyKwh, s.ttl_cst_amt AS totalCost, s.strt_ts AS startTime, s.sttus_cd AS status FROM sssn_lst_t s LEFT JOIN sttn_lst_t st ON st.sttn_id=s.sttn_id LEFT JOIN usr_lst_t u ON u.usr_id=s.usr_id ORDER BY s.sssn_id DESC`;
    return dbutil.execQuery(sqldb.MySQLConPool, QRY, cntxtDtls);
};

/*****************************************************************************
* Function      : getByIdMdl
* Description   : Single charge detail record by session/cdr id.
* Arguments     : data object with id
******************************************************************************/
exports.getByIdMdl = function (data) {
    const id = parseInt(data.id, 10) || 0;
    const QRY = `SELECT * FROM ( SELECT s.sssn_id AS cdrId, s.sssn_id AS sessionId, st.sttn_nm_tx AS stationName, u.nm_tx AS driverName, s.enrgy_cnsmd_kwh AS energyKwh, s.ttl_cst_amt AS totalCost, s.strt_ts AS startTime, s.sttus_cd AS status FROM sssn_lst_t s LEFT JOIN sttn_lst_t st ON st.sttn_id=s.sttn_id LEFT JOIN usr_lst_t u ON u.usr_id=s.usr_id ORDER BY s.sssn_id DESC ) q WHERE q.cdrId = ${id}`;
    return dbutil.execQuery(sqldb.MySQLConPool, QRY, cntxtDtls);
};
