/**
 * Web Reservations Model
 * Admin web console (djt-web) — connector reservations / bookings.
 * Read-only SELECTs only against the live `*_lst_t` schema.
 */

const sqldb = require(appRoot + '/config/db.config');
const dbutil = require(appRoot + '/utils/db.utils');
const cntxtDtls = "reservationsMdl";

/*****************************************************************************
* Function      : listMdl
* Description   : All reservations/bookings with user & station.
******************************************************************************/
exports.listMdl = function() {
    const QRY_TO_EXEC = `SELECT b.bkng_id AS id, b.bkng_cd AS code, u.nm_tx AS user, s.sttn_nm_tx AS station, b.bkng_dte AS date, b.bkng_tm AS time, b.sttus_cd AS status, b.cncltn_rsn_tx AS cancelReason FROM bkng_lst_t b LEFT JOIN usr_lst_t u ON u.usr_id=b.usr_id LEFT JOIN sttn_lst_t s ON s.sttn_id=b.sttn_id ORDER BY b.bkng_id DESC`;

    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};

/*****************************************************************************
* Function      : getByIdMdl
* Description   : Single reservation by primary id (list select wrapped).
* Arguments     : data object with id
******************************************************************************/
exports.getByIdMdl = function(data) {
    const id = parseInt(data.id, 10) || 0;
    const QRY_TO_EXEC = `SELECT * FROM ( SELECT b.bkng_id AS id, b.bkng_cd AS code, u.nm_tx AS user, s.sttn_nm_tx AS station, b.bkng_dte AS date, b.bkng_tm AS time, b.sttus_cd AS status, b.cncltn_rsn_tx AS cancelReason FROM bkng_lst_t b LEFT JOIN usr_lst_t u ON u.usr_id=b.usr_id LEFT JOIN sttn_lst_t s ON s.sttn_id=b.sttn_id ORDER BY b.bkng_id DESC ) q WHERE q.id = ${id}`;

    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};
