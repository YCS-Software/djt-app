/**
 * Users Model (admin web console — djt-web)
 * Back-office administrators and partner users from the live `usr_lst_t`
 * schema. Read-only SELECTs only.
 */

const sqldb = require(appRoot + '/config/db.config');
const dbutil = require(appRoot + '/utils/db.utils');

exports.listMdl = function () {
    const QRY = `SELECT usr_id AS id, nm_tx AS name, eml_tx AS email, phn_nmbr_tx AS phone, usr_typ_cd AS role, CASE WHEN a_in=1 THEN 'Active' ELSE 'Inactive' END AS status, i_ts AS createdAt FROM usr_lst_t WHERE usr_typ_cd IN ('admin','owner') ORDER BY usr_id DESC`;
    return dbutil.execQuery(sqldb.MySQLConPool, QRY, 'usersMdl');
};

exports.getByIdMdl = function (data) {
    const id = parseInt(data.id, 10) || 0;
    const QRY = `SELECT * FROM ( SELECT usr_id AS id, nm_tx AS name, eml_tx AS email, phn_nmbr_tx AS phone, usr_typ_cd AS role, CASE WHEN a_in=1 THEN 'Active' ELSE 'Inactive' END AS status, i_ts AS createdAt FROM usr_lst_t WHERE usr_typ_cd IN ('admin','owner') ORDER BY usr_id DESC ) q WHERE q.id = ${id}`;
    return dbutil.execQuery(sqldb.MySQLConPool, QRY, 'usersMdl');
};
