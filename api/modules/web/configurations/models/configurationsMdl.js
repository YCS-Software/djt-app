/**
 * Configurations Model
 * Admin web console (djt-web) — application configuration key/value pairs.
 * Backed by the live `sttng_lst_t` table (real columns: sttng_id,
 * sttng_ky_tx, sttng_vl_tx, dscrptn_tx, a_in, i_ts, u_ts).
 * The live schema has no per-station or readonly column, so those grid
 * fields are emitted as constants ('' / 0). DML allowed (saveByKey UPDATE).
 */

const sqldb = require(appRoot + '/config/db.config');
const dbutil = require(appRoot + '/utils/db.utils');
const cntxtDtls = "configurationsMdl";

/*****************************************************************************
* Function      : listMdl
* Description   : List configuration entries from sttng_lst_t.
*                 Columns: id, stationName, key, value, readonly, status.
******************************************************************************/
exports.listMdl = function() {
    const QRY = `SELECT sttng_id AS id, '' AS stationName, sttng_ky_tx AS \`key\`, sttng_vl_tx AS value, 0 AS readonly, CASE WHEN a_in=1 THEN 'Active' ELSE 'Inactive' END AS status FROM sttng_lst_t ORDER BY sttng_ky_tx ASC`;
    return dbutil.execQuery(sqldb.MySQLConPool, QRY, [], cntxtDtls);
};

/*****************************************************************************
* Function      : getByIdMdl
* Description   : Single configuration entry by primary id.
* Arguments     : data object with id
******************************************************************************/
exports.getByIdMdl = function(data) {
    const id = parseInt(data.id, 10) || 0;
    const QRY = `SELECT * FROM ( SELECT sttng_id AS id, '' AS stationName, sttng_ky_tx AS \`key\`, sttng_vl_tx AS value, 0 AS readonly, CASE WHEN a_in=1 THEN 'Active' ELSE 'Inactive' END AS status FROM sttng_lst_t ) q WHERE q.id = ?`;
    const PARAMS = [id];
    return dbutil.execQuery(sqldb.MySQLConPool, QRY, PARAMS, cntxtDtls);
};

/*****************************************************************************
* Function      : saveByKeyMdl
* Description   : Upsert a configuration value by key into sttng_lst_t.
* Arguments     : data object with key, value
******************************************************************************/
exports.saveByKeyMdl = function(data) {
    const key = String(data.key == null ? '' : data.key);
    const val = String(data.value == null ? '' : data.value);
    const QRY = `INSERT INTO sttng_lst_t (sttng_ky_tx, sttng_vl_tx, a_in) VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE sttng_vl_tx=?`;
    const PARAMS = [key, val, val];
    return dbutil.execQuery(sqldb.MySQLConPool, QRY, PARAMS, cntxtDtls);
};

/*****************************************************************************
* Function      : updateByIdMdl
* Description   : Update a configuration value by primary id.
* Arguments     : data object with id, value
******************************************************************************/
exports.updateByIdMdl = function(data) {
    const id = parseInt(data.id, 10) || 0;
    const val = String(data.value == null ? '' : data.value);
    const QRY = `UPDATE sttng_lst_t SET sttng_vl_tx=? WHERE sttng_id=?`;
    const PARAMS = [val, id];
    return dbutil.execQuery(sqldb.MySQLConPool, QRY, PARAMS, cntxtDtls);
};
