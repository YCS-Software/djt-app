/**
 * eMSP Tokens Model (admin web console — djt-web)
 * Roaming / eMSP tokens backed by the live `tkn_lst_t` schema (same table the
 * cards screen reads). Full CRUD via DML through execQuery.
 *
 * Note: tkn_lst_t carries tkn_id, usr_id, tkn_typ_cd, expry_ts, is_rvkd_in,
 * a_in, i_ts. contractId / issuer are not present as dedicated columns, so they
 * are exposed as NULL aliases to keep the grid fields stable.
 */

const sqldb = require(appRoot + '/config/db.config');
const dbutil = require(appRoot + '/utils/db.utils');
const cntxtDtls = "emspTokensMdl";

/*****************************************************************************
* Function      : listMdl
* Description   : eMSP / roaming tokens.
******************************************************************************/
exports.listMdl = function () {
    const QRY = `SELECT t.tkn_id AS uid, t.tkn_typ_cd AS type, NULL AS contractId, NULL AS issuer, CASE WHEN t.is_rvkd_in=1 THEN 'Revoked' WHEN t.a_in=1 THEN 'Active' ELSE 'Inactive' END AS status FROM tkn_lst_t t ORDER BY t.tkn_id DESC`;
    return dbutil.execQuery(sqldb.MySQLConPool, QRY, [], cntxtDtls);
};

/*****************************************************************************
* Function      : getByIdMdl
* Description   : Single eMSP token by id.
* Arguments     : data object with id
******************************************************************************/
exports.getByIdMdl = function (data) {
    const id = parseInt(data.id, 10) || 0;
    const QRY = `SELECT * FROM ( SELECT t.tkn_id AS uid, t.tkn_typ_cd AS type, NULL AS contractId, NULL AS issuer, CASE WHEN t.is_rvkd_in=1 THEN 'Revoked' WHEN t.a_in=1 THEN 'Active' ELSE 'Inactive' END AS status FROM tkn_lst_t t ORDER BY t.tkn_id DESC ) q WHERE q.uid = ?`;
    const PARAMS = [id];
    return dbutil.execQuery(sqldb.MySQLConPool, QRY, PARAMS, cntxtDtls);
};

/*****************************************************************************
* Function      : createMdl
* Description   : Insert a new eMSP token.
* Arguments     : data object with type
******************************************************************************/
exports.createMdl = function (data) {
    const type = data.type || 'rfid';
    const QRY = `INSERT INTO tkn_lst_t (tkn_typ_cd, a_in, i_ts) VALUES (?, 1, NOW())`;
    const PARAMS = [type];
    return dbutil.execQuery(sqldb.MySQLConPool, QRY, PARAMS, cntxtDtls);
};

/*****************************************************************************
* Function      : updateMdl
* Description   : Update an eMSP token's type by id.
* Arguments     : data object with id, type
******************************************************************************/
exports.updateMdl = function (data) {
    const id = parseInt(data.id, 10) || 0;
    const type = data.type || 'rfid';
    const QRY = `UPDATE tkn_lst_t SET tkn_typ_cd=? WHERE tkn_id=?`;
    const PARAMS = [type, id];
    return dbutil.execQuery(sqldb.MySQLConPool, QRY, PARAMS, cntxtDtls);
};

/*****************************************************************************
* Function      : deleteMdl
* Description   : Soft-delete (deactivate) an eMSP token by id.
* Arguments     : data object with id
******************************************************************************/
exports.deleteMdl = function (data) {
    const id = parseInt(data.id, 10) || 0;
    const QRY = `UPDATE tkn_lst_t SET a_in=0 WHERE tkn_id=?`;
    const PARAMS = [id];
    return dbutil.execQuery(sqldb.MySQLConPool, QRY, PARAMS, cntxtDtls);
};
