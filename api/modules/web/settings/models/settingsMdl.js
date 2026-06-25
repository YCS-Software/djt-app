/**
 * Settings Model
 * Admin web console (djt-web) — scope-keyed application settings.
 * Backed by the live `sttng_lst_t` table (sttng_ky_tx / sttng_vl_tx).
 * Convention: settings for a given scope are stored with keys prefixed
 * `<scope>.` (e.g. `general.siteName`). A scope read returns the de-prefixed
 * key/value blob; a missing scope yields an empty object.
 */

const sqldb = require(appRoot + '/config/db.config');
const dbutil = require(appRoot + '/utils/db.utils');
const cntxtDtls = "settingsMdl";

/*****************************************************************************
* Function      : getByScopeMdl
* Description   : Fetch all key/value rows whose key starts with '<scope>.'.
* Arguments     : data object with scope
******************************************************************************/
exports.getByScopeMdl = function(data) {
    const scope = String(data.scope == null ? '' : data.scope);
    const prefix = sqldb.MySQLConPool.escape(scope + '.%');
    const QRY = `SELECT sttng_ky_tx AS k, sttng_vl_tx AS v FROM sttng_lst_t WHERE a_in=1 AND sttng_ky_tx LIKE ${prefix}`;
    return dbutil.execQuery(sqldb.MySQLConPool, QRY, cntxtDtls);
};

/*****************************************************************************
* Function      : saveByScopeMdl
* Description   : Upsert a single scoped setting (stored as '<scope>.<key>').
* Arguments     : data object with scope, key, value
******************************************************************************/
exports.saveByScopeMdl = function(data) {
    const scope = String(data.scope == null ? '' : data.scope);
    const fullKey = sqldb.MySQLConPool.escape(scope + '.' + String(data.key == null ? '' : data.key));
    const val = sqldb.MySQLConPool.escape(String(data.value == null ? '' : data.value));
    const QRY = `INSERT INTO sttng_lst_t (sttng_ky_tx, sttng_vl_tx, a_in) VALUES (${fullKey}, ${val}, 1) ON DUPLICATE KEY UPDATE sttng_vl_tx=${val}`;
    return dbutil.execQuery(sqldb.MySQLConPool, QRY, cntxtDtls);
};
