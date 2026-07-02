/**
 * Roles Model
 * Admin web console (djt-web) — user roles derived from the live `usr_lst_t`
 * table by distinct `usr_typ_cd`, with a per-role user count.
 * Columns: id, name, description, users, status. Read-only.
 */

const sqldb = require(appRoot + '/config/db.config');
const dbutil = require(appRoot + '/utils/db.utils');
const cntxtDtls = "rolesMdl";

/*****************************************************************************
* Function      : listMdl
* Description   : Distinct user roles with user counts.
******************************************************************************/
exports.listMdl = function() {
    const QRY = `SELECT usr_typ_cd AS id, usr_typ_cd AS name, CONCAT('System role: ', usr_typ_cd) AS description, COUNT(*) AS users, 'Active' AS status FROM usr_lst_t WHERE usr_typ_cd IS NOT NULL AND usr_typ_cd <> '' GROUP BY usr_typ_cd ORDER BY users DESC`;
    return dbutil.execQuery(sqldb.MySQLConPool, QRY, [], cntxtDtls);
};

/*****************************************************************************
* Function      : getByIdMdl
* Description   : Single role (by usr_typ_cd) with user count.
* Arguments     : data object with id (role code)
******************************************************************************/
exports.getByIdMdl = function(data) {
    const code = String(data.id == null ? '' : data.id);
    const QRY = `SELECT usr_typ_cd AS id, usr_typ_cd AS name, CONCAT('System role: ', usr_typ_cd) AS description, COUNT(*) AS users, 'Active' AS status FROM usr_lst_t WHERE usr_typ_cd = ? GROUP BY usr_typ_cd`;
    const PARAMS = [code];
    return dbutil.execQuery(sqldb.MySQLConPool, QRY, PARAMS, cntxtDtls);
};
