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
    const QRY = `SELECT * FROM ( SELECT sttn_id AS id, sttn_nm_tx AS name, sttn_cd AS code, cty_tx AS city, stte_tx AS state, ttl_chrgrs_nbr AS totalChargers, avlbl_chrgrs_nbr AS availableChargers, prce_per_kwh_amt AS pricePerKwh, rtng_nbr AS rating, UPPER(COALESCE(NULLIF(aprvl_sttus_cd,''),'UNKNOWN')) AS status FROM sttn_lst_t ORDER BY sttn_id DESC ) q WHERE q.id = ${id}`;
    return dbutil.execQuery(sqldb.MySQLConPool, QRY, cntxtDtls);
};
