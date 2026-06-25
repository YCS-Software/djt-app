/**
 * Live Sessions Model (admin web console — djt-web)
 * Currently-active charging sessions from the `sssn_lst_t` schema joined to
 * station and user for display. Read-only SELECT.
 */

const sqldb = require(appRoot + '/config/db.config');
const dbutil = require(appRoot + '/utils/db.utils');
const cntxtDtls = "liveSessionsMdl";

/*****************************************************************************
* Function      : listMdl
* Description   : Active charging sessions (sttus_cd='active').
******************************************************************************/
exports.listMdl = function () {
    const QRY = `SELECT s.sssn_id AS id, st.sttn_nm_tx AS stationName, u.nm_tx AS driverName, s.enrgy_cnsmd_kwh AS energy, s.prgrss_pct AS progress, s.strt_ts AS startTime, s.sttus_cd AS status FROM sssn_lst_t s LEFT JOIN sttn_lst_t st ON st.sttn_id=s.sttn_id LEFT JOIN usr_lst_t u ON u.usr_id=s.usr_id WHERE s.sttus_cd='active' ORDER BY s.sssn_id DESC`;
    return dbutil.execQuery(sqldb.MySQLConPool, QRY, [], cntxtDtls);
};
