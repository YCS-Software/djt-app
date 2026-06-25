/**
 * Web Coupons Model
 * Admin web console (djt-web) — discount offers and promo codes.
 * Read-only SELECTs only against the live `*_lst_t` schema.
 */

const sqldb = require(appRoot + '/config/db.config');
const dbutil = require(appRoot + '/utils/db.utils');
const cntxtDtls = "couponsMdl";

/*****************************************************************************
* Function      : listMdl
* Description   : All discount offers / promo codes.
******************************************************************************/
exports.listMdl = function() {
    const QRY_TO_EXEC = `SELECT offr_id AS id, offr_cd AS code, ttl_tx AS title, dscnt_typ_cd AS discountType, dscnt_vl AS discountValue, mn_trxn_amt AS minAmount, strt_dte AS startDate, end_dte AS endDate, mx_uses_nbr AS maxUses, CASE WHEN a_in=1 THEN 'Active' ELSE 'Inactive' END AS status FROM offr_lst_t ORDER BY offr_id DESC`;

    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, [], cntxtDtls);
};

/*****************************************************************************
* Function      : getByIdMdl
* Description   : Single coupon by primary id (list select wrapped).
* Arguments     : data object with id
******************************************************************************/
exports.getByIdMdl = function(data) {
    const id = parseInt(data.id, 10) || 0;
    const QRY_TO_EXEC = `SELECT * FROM ( SELECT offr_id AS id, offr_cd AS code, ttl_tx AS title, dscnt_typ_cd AS discountType, dscnt_vl AS discountValue, mn_trxn_amt AS minAmount, strt_dte AS startDate, end_dte AS endDate, mx_uses_nbr AS maxUses, CASE WHEN a_in=1 THEN 'Active' ELSE 'Inactive' END AS status FROM offr_lst_t ORDER BY offr_id DESC ) q WHERE q.id = ?`;

    const PARAMS = [id];
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};
