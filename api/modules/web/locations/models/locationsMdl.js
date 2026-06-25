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
    return dbutil.execQuery(sqldb.MySQLConPool, QRY, cntxtDtls);
};

/*****************************************************************************
* Function      : getByIdMdl
* Description   : Single location detail by primary id.
* Arguments     : data object with id
******************************************************************************/
exports.getByIdMdl = function(data) {
    const id = parseInt(data.id, 10) || 0;
    const QRY = `SELECT * FROM ( SELECT sttn_id AS id, sttn_nm_tx AS name, sttn_cd AS code, cty_tx AS city, stte_tx AS state, ttl_chrgrs_nbr AS totalChargers, avlbl_chrgrs_nbr AS availableChargers, prce_per_kwh_amt AS pricePerKwh, rtng_nbr AS rating, addr_tx AS address, ltde_nbr AS latitude, lngtde_nbr AS longitude, UPPER(COALESCE(NULLIF(aprvl_sttus_cd,''),'UNKNOWN')) AS status FROM sttn_lst_t ORDER BY sttn_id DESC ) q WHERE q.id = ${id}`;
    return dbutil.execQuery(sqldb.MySQLConPool, QRY, cntxtDtls);
};

/*****************************************************************************
* Function      : createMdl
* Description   : Insert a charging site location (sttn_lst_t).
* Arguments     : data object { name, code, city, state, address,
*                 totalChargers, pricePerKwh, latitude, longitude }
******************************************************************************/
exports.createMdl = function(data) {
    const name = sqldb.MySQLConPool.escape(data.name || '');
    const code = sqldb.MySQLConPool.escape(data.code || ('STN' + Date.now()));
    const addr = sqldb.MySQLConPool.escape(data.address || (data.city || '') + ' ' + (data.state || ''));
    const city = sqldb.MySQLConPool.escape(data.city || '');
    const state = sqldb.MySQLConPool.escape(data.state || '');
    const totalChargers = parseInt(data.totalChargers, 10) || 1;
    const price = Number(data.pricePerKwh) || 0;
    const lat = (data.latitude === undefined || data.latitude === null || data.latitude === '') ? 'NULL' : Number(data.latitude);
    const lng = (data.longitude === undefined || data.longitude === null || data.longitude === '') ? 'NULL' : Number(data.longitude);
    const QRY = `INSERT INTO sttn_lst_t (sttn_nm_tx, sttn_cd, addr_tx, cty_tx, stte_tx, ttl_chrgrs_nbr, avlbl_chrgrs_nbr, prce_per_kwh_amt, ltde_nbr, lngtde_nbr, a_in, i_ts) VALUES (${name}, ${code}, ${addr}, ${city}, ${state}, ${totalChargers}, ${totalChargers}, ${price}, ${lat}, ${lng}, 1, NOW())`;
    return dbutil.execQuery(sqldb.MySQLConPool, QRY, cntxtDtls);
};

/*****************************************************************************
* Function      : updateMdl
* Description   : Update a charging site location by id.
******************************************************************************/
exports.updateMdl = function(data) {
    const id = parseInt(data.id, 10) || 0;
    const name = sqldb.MySQLConPool.escape(data.name || '');
    const city = sqldb.MySQLConPool.escape(data.city || '');
    const state = sqldb.MySQLConPool.escape(data.state || '');
    const addr = sqldb.MySQLConPool.escape(data.address || (data.city || '') + ' ' + (data.state || ''));
    const totalChargers = parseInt(data.totalChargers, 10) || 1;
    const price = Number(data.pricePerKwh) || 0;
    const lat = (data.latitude === undefined || data.latitude === null || data.latitude === '') ? 'ltde_nbr' : Number(data.latitude);
    const lng = (data.longitude === undefined || data.longitude === null || data.longitude === '') ? 'lngtde_nbr' : Number(data.longitude);
    const QRY = `UPDATE sttn_lst_t SET sttn_nm_tx=${name}, addr_tx=${addr}, cty_tx=${city}, stte_tx=${state}, ttl_chrgrs_nbr=${totalChargers}, prce_per_kwh_amt=${price}, ltde_nbr=${lat}, lngtde_nbr=${lng}, u_ts=NOW() WHERE sttn_id=${id}`;
    return dbutil.execQuery(sqldb.MySQLConPool, QRY, cntxtDtls);
};

/*****************************************************************************
* Function      : deleteMdl
* Description   : Soft-delete a charging site location (a_in=0).
******************************************************************************/
exports.deleteMdl = function(data) {
    const id = parseInt(data.id, 10) || 0;
    const QRY = `UPDATE sttn_lst_t SET a_in=0, u_ts=NOW() WHERE sttn_id=${id}`;
    return dbutil.execQuery(sqldb.MySQLConPool, QRY, cntxtDtls);
};
