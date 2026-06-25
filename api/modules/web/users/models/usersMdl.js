/**
 * Users Model (admin web console — djt-web)
 * Back-office administrators and partner users from the live `usr_lst_t`
 * schema. Read-only SELECTs only.
 */

const sqldb = require(appRoot + '/config/db.config');
const dbutil = require(appRoot + '/utils/db.utils');

exports.listMdl = function () {
    const QRY = `SELECT usr_id AS id, nm_tx AS name, eml_tx AS email, phn_nmbr_tx AS phone, usr_typ_cd AS role, CASE WHEN a_in=1 THEN 'Active' ELSE 'Inactive' END AS status, i_ts AS createdAt FROM usr_lst_t WHERE usr_typ_cd IN ('admin','owner') ORDER BY usr_id DESC`;
    return dbutil.execQuery(sqldb.MySQLConPool, QRY, [], 'usersMdl');
};

exports.getByIdMdl = function (data) {
    const id = parseInt(data.id, 10) || 0;
    const QRY = `SELECT * FROM ( SELECT usr_id AS id, nm_tx AS name, eml_tx AS email, phn_nmbr_tx AS phone, usr_typ_cd AS role, CASE WHEN a_in=1 THEN 'Active' ELSE 'Inactive' END AS status, i_ts AS createdAt FROM usr_lst_t WHERE usr_typ_cd IN ('admin','owner') ORDER BY usr_id DESC ) q WHERE q.id = ?`;
    const PARAMS = [id];
    return dbutil.execQuery(sqldb.MySQLConPool, QRY, PARAMS, 'usersMdl');
};

/*****************************************************************************
* Function      : createMdl
* Description   : Insert a back-office user (usr_lst_t).
* Arguments     : data object { name, email, phone, role }
******************************************************************************/
exports.createMdl = function (data) {
    const name = data.name || '';
    const email = data.email || '';
    const phone = data.phone || '';
    const role = data.role || 'admin';
    const QRY = `INSERT INTO usr_lst_t (nm_tx, eml_tx, phn_nmbr_tx, usr_typ_cd, a_in, i_ts) VALUES (?, ?, ?, ?, 1, NOW())`;
    const PARAMS = [name, email, phone, role];
    return dbutil.execQuery(sqldb.MySQLConPool, QRY, PARAMS, 'usersMdl');
};

/*****************************************************************************
* Function      : updateMdl
* Description   : Update a back-office user by id.
* Arguments     : data object { id, name, email, phone, role }
******************************************************************************/
exports.updateMdl = function (data) {
    const id = parseInt(data.id, 10) || 0;
    const name = data.name || '';
    const email = data.email || '';
    const phone = data.phone || '';
    const role = data.role || 'admin';
    const QRY = `UPDATE usr_lst_t SET nm_tx=?, eml_tx=?, phn_nmbr_tx=?, usr_typ_cd=?, u_ts=NOW() WHERE usr_id=?`;
    const PARAMS = [name, email, phone, role, id];
    return dbutil.execQuery(sqldb.MySQLConPool, QRY, PARAMS, 'usersMdl');
};

/*****************************************************************************
* Function      : deleteMdl
* Description   : Soft-delete a back-office user (a_in=0, d_ts=NOW()).
* Arguments     : data object { id }
******************************************************************************/
exports.deleteMdl = function (data) {
    const id = parseInt(data.id, 10) || 0;
    const QRY = `UPDATE usr_lst_t SET a_in=0, d_ts=NOW() WHERE usr_id=?`;
    const PARAMS = [id];
    return dbutil.execQuery(sqldb.MySQLConPool, QRY, PARAMS, 'usersMdl');
};
