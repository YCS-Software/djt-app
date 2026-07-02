/**
 * Locations Model
 * Admin web console (djt-web) — charging site locations list/detail.
 * Read-only SELECTs against the live `*_lst_t` schema.
 */

const sqldb = require(appRoot + '/config/db.config');
const dbutil = require(appRoot + '/utils/db.utils');
const cntxtDtls = "locationsMdl";

/*****************************************************************************
* Function      : listMdl
* Description   : Charging site locations across the network.
******************************************************************************/
exports.listMdl = function() {
    const QRY = `SELECT sttn_id AS id, sttn_nm_tx AS name, sttn_cd AS code, cty_tx AS city, stte_tx AS state, ttl_chrgrs_nbr AS totalChargers, avlbl_chrgrs_nbr AS availableChargers, prce_per_kwh_amt AS pricePerKwh, rtng_nbr AS rating, UPPER(COALESCE(NULLIF(aprvl_sttus_cd,''),'UNKNOWN')) AS status FROM sttn_lst_t ORDER BY sttn_id DESC`;
    return dbutil.execQuery(sqldb.MySQLConPool, QRY, [], cntxtDtls);
};

/*****************************************************************************
* Function      : getByIdMdl
* Description   : Single location detail by primary id.
* Arguments     : data object with id
******************************************************************************/
exports.getByIdMdl = function(data) {
    const id = parseInt(data.id, 10) || 0;
    const QRY = `SELECT * FROM ( SELECT sttn_id AS id, sttn_nm_tx AS name, sttn_cd AS code, cty_tx AS city, stte_tx AS state, ttl_chrgrs_nbr AS totalChargers, avlbl_chrgrs_nbr AS availableChargers, prce_per_kwh_amt AS pricePerKwh, rtng_nbr AS rating, addr_tx AS address, ltde_nbr AS latitude, lngtde_nbr AS longitude, UPPER(COALESCE(NULLIF(aprvl_sttus_cd,''),'UNKNOWN')) AS status FROM sttn_lst_t ORDER BY sttn_id DESC ) q WHERE q.id = ?`;
    const PARAMS = [id];
    return dbutil.execQuery(sqldb.MySQLConPool, QRY, PARAMS, cntxtDtls);
};

/*****************************************************************************
* Function      : createMdl
* Description   : Insert a charging site location (sttn_lst_t).
* Arguments     : data object { name, code, city, state, address,
*                 totalChargers, pricePerKwh, latitude, longitude }
******************************************************************************/
exports.createMdl = function(data) {
    const name = data.name || '';
    const code = data.code || ('STN' + Date.now());
    const addr = data.address || (data.city || '') + ' ' + (data.state || '');
    const city = data.city || '';
    const state = data.state || '';
    const totalChargers = parseInt(data.totalChargers, 10) || 1;
    const price = Number(data.pricePerKwh) || 0;
    const lat = (data.latitude === undefined || data.latitude === null || data.latitude === '') ? null : Number(data.latitude);
    const lng = (data.longitude === undefined || data.longitude === null || data.longitude === '') ? null : Number(data.longitude);
    const QRY = `INSERT INTO sttn_lst_t (sttn_nm_tx, sttn_cd, addr_tx, cty_tx, stte_tx, ttl_chrgrs_nbr, avlbl_chrgrs_nbr, prce_per_kwh_amt, ltde_nbr, lngtde_nbr, a_in, i_ts) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW())`;
    const PARAMS = [name, code, addr, city, state, totalChargers, totalChargers, price, lat, lng];
    return dbutil.execQuery(sqldb.MySQLConPool, QRY, PARAMS, cntxtDtls);
};

/*****************************************************************************
* Function      : updateMdl
* Description   : Update a charging site location by id.
******************************************************************************/
exports.updateMdl = function(data) {
    const id = parseInt(data.id, 10) || 0;
    const name = data.name || '';
    const city = data.city || '';
    const state = data.state || '';
    const addr = data.address || (data.city || '') + ' ' + (data.state || '');
    const totalChargers = parseInt(data.totalChargers, 10) || 1;
    const price = Number(data.pricePerKwh) || 0;
    // When lat/lng not supplied, keep the existing column value (self-assignment,
    // no bind param); otherwise bind the numeric value.
    const latProvided = !(data.latitude === undefined || data.latitude === null || data.latitude === '');
    const lngProvided = !(data.longitude === undefined || data.longitude === null || data.longitude === '');
    const latClause = latProvided ? '?' : 'ltde_nbr';
    const lngClause = lngProvided ? '?' : 'lngtde_nbr';
    const PARAMS = [name, addr, city, state, totalChargers, price];
    if (latProvided) PARAMS.push(Number(data.latitude));
    if (lngProvided) PARAMS.push(Number(data.longitude));
    PARAMS.push(id);
    const QRY = `UPDATE sttn_lst_t SET sttn_nm_tx=?, addr_tx=?, cty_tx=?, stte_tx=?, ttl_chrgrs_nbr=?, prce_per_kwh_amt=?, ltde_nbr=${latClause}, lngtde_nbr=${lngClause}, u_ts=NOW() WHERE sttn_id=?`;
    return dbutil.execQuery(sqldb.MySQLConPool, QRY, PARAMS, cntxtDtls);
};

/*****************************************************************************
* Function      : deleteMdl
* Description   : Soft-delete a charging site location (a_in=0).
******************************************************************************/
exports.deleteMdl = function(data) {
    const id = parseInt(data.id, 10) || 0;
    const QRY = `UPDATE sttn_lst_t SET a_in=0, u_ts=NOW() WHERE sttn_id=?`;
    const PARAMS = [id];
    return dbutil.execQuery(sqldb.MySQLConPool, QRY, PARAMS, cntxtDtls);
};
