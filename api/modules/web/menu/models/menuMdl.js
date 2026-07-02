/**
 * Web Menu Model (admin web console — djt-web).
 * Resolves the logged-in user's role from the live usr_lst_t table so the
 * sidebar can be built per-role (login-based menu).
 */
const sqldb = require(appRoot + '/config/db.config');
const dbutil = require(appRoot + '/utils/db.utils');
const cntxtDtls = "menuMdl";

exports.getRoleMdl = function (data) {
    const id = parseInt(data.userId, 10) || 0;
    const QRY = `SELECT usr_typ_cd AS role FROM usr_lst_t WHERE usr_id = ? AND a_in = 1 LIMIT 1`;
    const PARAMS = [id];
    return dbutil.execQuery(sqldb.MySQLConPool, QRY, PARAMS, cntxtDtls).catch(() => []);
};
