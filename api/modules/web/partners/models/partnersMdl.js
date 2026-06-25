/**
 * Partners Model
 * Admin web console (djt-web) — partner organizations (station owners).
 * Read-only SELECTs only against the live `*_lst_t` schema.
 */

const sqldb = require(appRoot + '/config/db.config');
const dbutil = require(appRoot + '/utils/db.utils');
const cntxtDtls = "partnersMdl";

/*****************************************************************************
* Function      : listMdl
* Description   : List partner organizations (station owners).
******************************************************************************/
exports.listMdl = function() {
    const QRY = `SELECT u.usr_id AS id, u.nm_tx AS name, u.eml_tx AS email, u.phn_nmbr_tx AS phone, u.usr_typ_cd AS role, (SELECT COUNT(*) FROM sttn_lst_t s WHERE s.ownr_usr_id=u.usr_id AND s.a_in=1) AS stations, CASE WHEN u.a_in=1 THEN 'Active' ELSE 'Inactive' END AS status, u.i_ts AS createdAt FROM usr_lst_t u WHERE u.usr_typ_cd='owner' ORDER BY u.usr_id DESC`;
    return dbutil.execQuery(sqldb.MySQLConPool, QRY, cntxtDtls);
};

/*****************************************************************************
* Function      : getByIdMdl
* Description   : Single partner organization by primary id.
* Arguments     : data object with id
******************************************************************************/
exports.getByIdMdl = function(data) {
    const id = parseInt(data.id, 10) || 0;
    const QRY = `SELECT * FROM ( SELECT u.usr_id AS id, u.nm_tx AS name, u.eml_tx AS email, u.phn_nmbr_tx AS phone, u.usr_typ_cd AS role, (SELECT COUNT(*) FROM sttn_lst_t s WHERE s.ownr_usr_id=u.usr_id AND s.a_in=1) AS stations, CASE WHEN u.a_in=1 THEN 'Active' ELSE 'Inactive' END AS status, u.i_ts AS createdAt FROM usr_lst_t u WHERE u.usr_typ_cd='owner' ORDER BY u.usr_id DESC ) q WHERE q.id = ${id}`;
    return dbutil.execQuery(sqldb.MySQLConPool, QRY, cntxtDtls);
};

/*****************************************************************************
* Function      : createMdl
* Description   : Insert a partner organization (usr_lst_t, usr_typ_cd='owner').
* Arguments     : data object { name, email, phone }
******************************************************************************/
exports.createMdl = function(data) {
    const name = sqldb.MySQLConPool.escape(data.name || '');
    const email = sqldb.MySQLConPool.escape(data.email || '');
    const phone = sqldb.MySQLConPool.escape(data.phone || '');
    const QRY = `INSERT INTO usr_lst_t (nm_tx, eml_tx, phn_nmbr_tx, usr_typ_cd, a_in, i_ts) VALUES (${name}, ${email}, ${phone}, 'owner', 1, NOW())`;
    return dbutil.execQuery(sqldb.MySQLConPool, QRY, cntxtDtls);
};

/*****************************************************************************
* Function      : updateMdl
* Description   : Update a partner organization by id.
* Arguments     : data object { id, name, email, phone }
******************************************************************************/
exports.updateMdl = function(data) {
    const id = parseInt(data.id, 10) || 0;
    const name = sqldb.MySQLConPool.escape(data.name || '');
    const email = sqldb.MySQLConPool.escape(data.email || '');
    const phone = sqldb.MySQLConPool.escape(data.phone || '');
    const QRY = `UPDATE usr_lst_t SET nm_tx=${name}, eml_tx=${email}, phn_nmbr_tx=${phone}, u_ts=NOW() WHERE usr_id=${id} AND usr_typ_cd='owner'`;
    return dbutil.execQuery(sqldb.MySQLConPool, QRY, cntxtDtls);
};

/*****************************************************************************
* Function      : deleteMdl
* Description   : Soft-delete a partner organization (a_in=0, d_ts=NOW()).
* Arguments     : data object { id }
******************************************************************************/
exports.deleteMdl = function(data) {
    const id = parseInt(data.id, 10) || 0;
    const QRY = `UPDATE usr_lst_t SET a_in=0, d_ts=NOW() WHERE usr_id=${id} AND usr_typ_cd='owner'`;
    return dbutil.execQuery(sqldb.MySQLConPool, QRY, cntxtDtls);
};
