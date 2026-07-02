/**
 * Schedules Model
 * Admin web console (djt-web) — scheduled charging bookings. Read-only SELECTs.
 */

const sqldb = require(appRoot + '/config/db.config');
const dbutil = require(appRoot + '/utils/db.utils');
const cntxtDtls = "schedulesMdl";

/*****************************************************************************
* Function      : listMdl
* Description   : All scheduled bookings with user and station.
******************************************************************************/
exports.listMdl = function() {
    const QRY = `SELECT b.bkng_id AS id, b.bkng_cd AS code, u.nm_tx AS user, s.sttn_nm_tx AS station, b.bkng_dte AS date, b.bkng_tm AS time, b.durn_mnts_nbr AS durationMinutes, b.sttus_cd AS status FROM bkng_lst_t b LEFT JOIN usr_lst_t u ON u.usr_id=b.usr_id LEFT JOIN sttn_lst_t s ON s.sttn_id=b.sttn_id ORDER BY b.bkng_dte DESC, b.bkng_tm DESC`;
    return dbutil.execQuery(sqldb.MySQLConPool, QRY, [], cntxtDtls);
};

/*****************************************************************************
* Function      : getByIdMdl
* Description   : Single scheduled booking by booking id.
* Arguments     : data object with id
******************************************************************************/
exports.getByIdMdl = function(data) {
    const id = parseInt(data.id, 10) || 0;
    const QRY = `SELECT * FROM ( SELECT b.bkng_id AS id, b.bkng_cd AS code, u.nm_tx AS user, s.sttn_nm_tx AS station, b.bkng_dte AS date, b.bkng_tm AS time, b.durn_mnts_nbr AS durationMinutes, b.sttus_cd AS status FROM bkng_lst_t b LEFT JOIN usr_lst_t u ON u.usr_id=b.usr_id LEFT JOIN sttn_lst_t s ON s.sttn_id=b.sttn_id ORDER BY b.bkng_dte DESC, b.bkng_tm DESC ) q WHERE q.id = ?`;
    const PARAMS = [id];
    return dbutil.execQuery(sqldb.MySQLConPool, QRY, PARAMS, cntxtDtls);
};
