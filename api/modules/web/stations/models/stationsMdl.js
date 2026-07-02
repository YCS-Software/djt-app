/**
 * Stations Model (web admin console)
 * Read-only SELECTs against the live `*_lst_t` schema. SELECT only.
 */

const sqldb = require(appRoot + '/config/db.config');
const dbutil = require(appRoot + '/utils/db.utils');
const cntxtDtls = "stationsMdl";

/*****************************************************************************
* Function      : listMdl
* Description   : Chargers (machines) across all locations.
******************************************************************************/
exports.listMdl = function() {
    const QRY_TO_EXEC = `SELECT m.mchn_id AS id, m.mchn_nm_tx AS name, m.mchn_srl_no_tx AS serial, m.ocpp_id_tx AS ocppId, m.mchn_typ_cd AS type, m.max_pwr_tx AS power, m.ttl_cnntrs_nbr AS connectors, s.sttn_nm_tx AS station, m.sttus_cd AS status, m.lst_hb_ts AS lastHeartbeat FROM mchn_lst_t m LEFT JOIN sttn_lst_t s ON s.sttn_id=m.sttn_id ORDER BY m.mchn_id DESC`;

    console.log('[listMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, [], cntxtDtls);
};

/*****************************************************************************
* Function      : getByIdMdl
* Description   : Single station/charger detail filtered by primary id column.
* Arguments     : data object with id
******************************************************************************/
exports.getByIdMdl = function(data) {
    const id = parseInt(data.id, 10) || 0;
    const QRY_TO_EXEC = `SELECT * FROM ( SELECT m.mchn_id AS id, m.mchn_nm_tx AS name, m.mchn_srl_no_tx AS serial, m.ocpp_id_tx AS ocppId, m.mchn_typ_cd AS type, m.max_pwr_tx AS power, m.ttl_cnntrs_nbr AS connectors, s.sttn_nm_tx AS station, m.sttus_cd AS status, m.lst_hb_ts AS lastHeartbeat FROM mchn_lst_t m LEFT JOIN sttn_lst_t s ON s.sttn_id=m.sttn_id ORDER BY m.mchn_id DESC ) q WHERE q.id = ?`;
    const PARAMS = [id];

    console.log('[getByIdMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

/*****************************************************************************
* Function      : createMdl
* Description   : Register a charger/machine (mchn_lst_t) at a station.
* Arguments     : data { stationId, name, serial, ocppId, type, power,
*                        connectors, status }
******************************************************************************/
exports.createMdl = function(data) {
    const esc = (v) => sqldb.MySQLConPool.escape(v == null ? '' : v);
    const sttnId = parseInt(data.stationId, 10) || 0;
    const connectors = parseInt(data.connectors, 10) || 1;
    const QRY = `INSERT INTO mchn_lst_t (sttn_id, mchn_nm_tx, mchn_srl_no_tx, ocpp_id_tx, mchn_typ_cd, max_pwr_tx, ttl_cnntrs_nbr, sttus_cd, a_in, i_ts)
        VALUES (${sttnId}, ${esc(data.name)}, ${esc(data.serial)}, ${esc(data.ocppId)}, ${esc(data.type || 'DC')}, ${esc(data.power)}, ${connectors}, ${esc(data.status || 'available')}, 1, NOW())`;
    return dbutil.execQuery(sqldb.MySQLConPool, QRY, cntxtDtls);
};
