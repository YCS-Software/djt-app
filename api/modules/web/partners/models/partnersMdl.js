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
