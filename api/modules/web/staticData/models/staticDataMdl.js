/**
 * Static Data Model
 * Admin web console (djt-web) — system lookup / static reference data.
 * Backed by the live `sttng_lst_t` key/value settings table (real columns:
 * sttng_id, sttng_ky_tx, sttng_vl_tx, dscrptn_tx, a_in, i_ts, u_ts).
 * There is no dedicated category column on the live schema, so a static
 * 'general' category label is emitted to satisfy the grid contract.
 * Read-only SELECTs only.
 */

const sqldb = require(appRoot + '/config/db.config');
const dbutil = require(appRoot + '/utils/db.utils');
const cntxtDtls = "staticDataMdl";

/*****************************************************************************
* Function      : listMdl
* Description   : List static/reference data entries from sttng_lst_t.
*                 Columns: id, category, code, label, value, status.
******************************************************************************/
exports.listMdl = function() {
    const QRY = `SELECT sttng_id AS id, 'general' AS category, sttng_ky_tx AS code, COALESCE(NULLIF(dscrptn_tx,''), sttng_ky_tx) AS label, sttng_vl_tx AS value, CASE WHEN a_in=1 THEN 'Active' ELSE 'Inactive' END AS status FROM sttng_lst_t ORDER BY sttng_ky_tx ASC`;
    return dbutil.execQuery(sqldb.MySQLConPool, QRY, cntxtDtls);
};

/*****************************************************************************
* Function      : getByIdMdl
* Description   : Single static-data entry by primary id.
* Arguments     : data object with id
******************************************************************************/
exports.getByIdMdl = function(data) {
    const id = parseInt(data.id, 10) || 0;
    const QRY = `SELECT * FROM ( SELECT sttng_id AS id, 'general' AS category, sttng_ky_tx AS code, COALESCE(NULLIF(dscrptn_tx,''), sttng_ky_tx) AS label, sttng_vl_tx AS value, CASE WHEN a_in=1 THEN 'Active' ELSE 'Inactive' END AS status FROM sttng_lst_t ) q WHERE q.id = ${id}`;
    return dbutil.execQuery(sqldb.MySQLConPool, QRY, cntxtDtls);
};
