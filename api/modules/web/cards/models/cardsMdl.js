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

/*****************************************************************************
* Function      : createMdl
* Description   : Issue an RFID / charge token to a driver (tkn_lst_t).
* Arguments     : data { userId, rfid, type, expiresAt }
*                 expry_ts is NOT NULL — defaults to +1 year when omitted.
******************************************************************************/
exports.createMdl = function (data) {
    const usrId = parseInt(data.userId, 10) || 0;
    const rfid = sqldb.MySQLConPool.escape(data.rfid || '');
    const type = sqldb.MySQLConPool.escape(data.type || 'rfid');
    const expiry = data.expiresAt
        ? sqldb.MySQLConPool.escape(data.expiresAt)
        : 'DATE_ADD(NOW(), INTERVAL 1 YEAR)';
    const QRY = `INSERT INTO tkn_lst_t (usr_id, tkn_tx, tkn_typ_cd, expry_ts, is_rvkd_in, a_in, i_ts)
        VALUES (${usrId}, ${rfid}, ${type}, ${expiry}, 0, 1, NOW())`;
    return dbutil.execQuery(sqldb.MySQLConPool, QRY, 'cardsMdl');
};
