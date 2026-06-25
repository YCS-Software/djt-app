/**
 * Cards Model (admin web console — djt-web)
 * RFID / charge tokens issued to drivers from the live `tkn_lst_t`
 * schema. Read-only SELECTs only.
 */

const sqldb = require(appRoot + '/config/db.config');
const dbutil = require(appRoot + '/utils/db.utils');

exports.listMdl = function () {
    const QRY = `SELECT t.tkn_id AS id, u.nm_tx AS user, t.tkn_typ_cd AS type, t.expry_ts AS expiresAt, CASE WHEN t.is_rvkd_in=1 THEN 'Revoked' WHEN t.a_in=1 THEN 'Active' ELSE 'Inactive' END AS status, t.i_ts AS createdAt FROM tkn_lst_t t LEFT JOIN usr_lst_t u ON u.usr_id=t.usr_id ORDER BY t.tkn_id DESC`;
    return dbutil.execQuery(sqldb.MySQLConPool, QRY, [], 'cardsMdl');
};

exports.getByIdMdl = function (data) {
    const id = parseInt(data.id, 10) || 0;
    const QRY = `SELECT * FROM ( SELECT t.tkn_id AS id, u.nm_tx AS user, t.tkn_typ_cd AS type, t.expry_ts AS expiresAt, CASE WHEN t.is_rvkd_in=1 THEN 'Revoked' WHEN t.a_in=1 THEN 'Active' ELSE 'Inactive' END AS status, t.i_ts AS createdAt FROM tkn_lst_t t LEFT JOIN usr_lst_t u ON u.usr_id=t.usr_id ORDER BY t.tkn_id DESC ) q WHERE q.id = ?`;
    const PARAMS = [id];
    return dbutil.execQuery(sqldb.MySQLConPool, QRY, PARAMS, 'cardsMdl');
};
