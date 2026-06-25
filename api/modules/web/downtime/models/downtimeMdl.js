/**
 * Downtime Model (admin web console — djt-web)
 * Derived from the `mchn_lst_t` schema: any machine whose status is not
 * 'available' is treated as a downtime entry. Read-only.
 *
 * Only stationName and status map to real columns; connectorId / reason /
 * endTime / durationHours are not tracked as dedicated columns, so they are
 * exposed as NULL (or derived) aliases to keep the grid fields stable.
 */

const sqldb = require(appRoot + '/config/db.config');
const dbutil = require(appRoot + '/utils/db.utils');
const cntxtDtls = "downtimeMdl";

/*****************************************************************************
* Function      : listMdl
* Description   : Chargers currently out of the 'available' state.
******************************************************************************/
exports.listMdl = function () {
    const QRY = `SELECT m.mchn_id AS id, s.sttn_nm_tx AS stationName, NULL AS connectorId, m.sttus_cd AS reason, m.lst_hb_ts AS startTime, NULL AS endTime, NULL AS durationHours, m.sttus_cd AS status FROM mchn_lst_t m LEFT JOIN sttn_lst_t s ON s.sttn_id=m.sttn_id WHERE LOWER(COALESCE(m.sttus_cd,'')) <> 'available' ORDER BY m.mchn_id DESC`;
    return dbutil.execQuery(sqldb.MySQLConPool, QRY, [], cntxtDtls);
};

/*****************************************************************************
* Function      : getByIdMdl
* Description   : Single downtime entry by machine id.
* Arguments     : data object with id
******************************************************************************/
exports.getByIdMdl = function (data) {
    const id = parseInt(data.id, 10) || 0;
    const QRY = `SELECT * FROM ( SELECT m.mchn_id AS id, s.sttn_nm_tx AS stationName, NULL AS connectorId, m.sttus_cd AS reason, m.lst_hb_ts AS startTime, NULL AS endTime, NULL AS durationHours, m.sttus_cd AS status FROM mchn_lst_t m LEFT JOIN sttn_lst_t s ON s.sttn_id=m.sttn_id WHERE LOWER(COALESCE(m.sttus_cd,'')) <> 'available' ORDER BY m.mchn_id DESC ) q WHERE q.id = ?`;
    const PARAMS = [id];
    return dbutil.execQuery(sqldb.MySQLConPool, QRY, PARAMS, cntxtDtls);
};
