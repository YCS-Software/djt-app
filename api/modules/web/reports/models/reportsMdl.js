/**
 * Web Reports Model
 * Admin web console (djt-web) — revenue, energy and session reports by station.
 * Read-only SELECTs only against the live `*_lst_t` schema.
 */

const sqldb = require(appRoot + '/config/db.config');
const dbutil = require(appRoot + '/utils/db.utils');
const cntxtDtls = "reportsMdl";

/*****************************************************************************
* Function      : listMdl
* Description   : Revenue, energy and session totals aggregated by station.
******************************************************************************/
exports.listMdl = function() {
    const QRY_TO_EXEC = `SELECT s.sttn_id AS id, s.sttn_nm_tx AS station, s.cty_tx AS city, COUNT(se.sssn_id) AS sessions, COALESCE(SUM(se.enrgy_cnsmd_kwh),0) AS energyKwh, COALESCE(SUM(se.ttl_cst_amt),0) AS revenue FROM sttn_lst_t s LEFT JOIN sssn_lst_t se ON se.sttn_id=s.sttn_id AND se.sttus_cd='completed' GROUP BY s.sttn_id, s.sttn_nm_tx, s.cty_tx ORDER BY revenue DESC`;

    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};

/*****************************************************************************
* Function      : getByIdMdl
* Description   : Single station report by primary id (list select wrapped).
* Arguments     : data object with id
******************************************************************************/
exports.getByIdMdl = function(data) {
    const id = parseInt(data.id, 10) || 0;
    const QRY_TO_EXEC = `SELECT * FROM ( SELECT s.sttn_id AS id, s.sttn_nm_tx AS station, s.cty_tx AS city, COUNT(se.sssn_id) AS sessions, COALESCE(SUM(se.enrgy_cnsmd_kwh),0) AS energyKwh, COALESCE(SUM(se.ttl_cst_amt),0) AS revenue FROM sttn_lst_t s LEFT JOIN sssn_lst_t se ON se.sttn_id=s.sttn_id AND se.sttus_cd='completed' GROUP BY s.sttn_id, s.sttn_nm_tx, s.cty_tx ORDER BY revenue DESC ) q WHERE q.id = ${id}`;

    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};
