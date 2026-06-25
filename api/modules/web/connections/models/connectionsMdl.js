/**
 * Connections Model (admin web console — djt-web)
 * Live charger connections / heartbeats from the `mchn_lst_t` schema joined to
 * station for display. Read-only SELECTs only.
 */

const sqldb = require(appRoot + '/config/db.config');
const dbutil = require(appRoot + '/utils/db.utils');
const cntxtDtls = "connectionsMdl";

/*****************************************************************************
* Function      : listMdl
* Description   : Charger connection / heartbeat status across all machines.
******************************************************************************/
exports.listMdl = function () {
    const QRY = `SELECT m.mchn_id AS id, s.sttn_nm_tx AS stationName, m.ocpp_id_tx AS ocppId, 'OCPP1.6J' AS protocol, m.lst_hb_ts AS lastHeartbeat, m.sttus_cd AS status FROM mchn_lst_t m LEFT JOIN sttn_lst_t s ON s.sttn_id=m.sttn_id ORDER BY m.mchn_id DESC`;
    return dbutil.execQuery(sqldb.MySQLConPool, QRY, cntxtDtls);
};

/*****************************************************************************
* Function      : getByIdMdl
* Description   : Single charger connection by machine id.
* Arguments     : data object with id
******************************************************************************/
exports.getByIdMdl = function (data) {
    const id = parseInt(data.id, 10) || 0;
    const QRY = `SELECT * FROM ( SELECT m.mchn_id AS id, s.sttn_nm_tx AS stationName, m.ocpp_id_tx AS ocppId, 'OCPP1.6J' AS protocol, m.lst_hb_ts AS lastHeartbeat, m.sttus_cd AS status FROM mchn_lst_t m LEFT JOIN sttn_lst_t s ON s.sttn_id=m.sttn_id ORDER BY m.mchn_id DESC ) q WHERE q.id = ${id}`;
    return dbutil.execQuery(sqldb.MySQLConPool, QRY, cntxtDtls);
};
