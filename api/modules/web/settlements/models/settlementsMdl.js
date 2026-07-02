/**
 * Web Settlements Model
 * Admin web console (djt-web) — partner revenue settlements.
 * Attempts the live `setlmnt_lst_t` table; if its shape differs / is absent,
 * degrades gracefully to an empty result set (never throws to the controller).
 */

const sqldb = require(appRoot + '/config/db.config');
const dbutil = require(appRoot + '/utils/db.utils');
const cntxtDtls = "settlementsMdl";

/*****************************************************************************
* Function      : listMdl
* Description   : Partner settlements. Falls back to [] if the table/columns
*                 are not present in this environment.
******************************************************************************/
exports.listMdl = function () {
    const QRY = `SELECT s.setlmnt_id AS id,
                        u.nm_tx AS partnerName,
                        s.prd_tx AS period,
                        s.ttl_rvnu_amt AS totalRevenue,
                        s.cmsn_amt AS commission,
                        s.setlmnt_amt AS settlementAmount,
                        s.sttus_cd AS status
                 FROM setlmnt_lst_t s
                 LEFT JOIN usr_lst_t u ON u.usr_id = s.ownr_usr_id
                 ORDER BY s.setlmnt_id DESC`;
    return dbutil.execQuery(sqldb.MySQLConPool, QRY, [], cntxtDtls).catch(() => []);
};

/*****************************************************************************
* Function      : getByIdMdl
* Description   : Single settlement by id (graceful fallback).
******************************************************************************/
exports.getByIdMdl = function (data) {
    const id = parseInt(data.id, 10) || 0;
    const QRY = `SELECT s.setlmnt_id AS id, u.nm_tx AS partnerName, s.prd_tx AS period,
                        s.ttl_rvnu_amt AS totalRevenue, s.cmsn_amt AS commission,
                        s.setlmnt_amt AS settlementAmount, s.sttus_cd AS status
                 FROM setlmnt_lst_t s LEFT JOIN usr_lst_t u ON u.usr_id = s.ownr_usr_id
                 WHERE s.setlmnt_id = ?`;
    const PARAMS = [id];
    return dbutil.execQuery(sqldb.MySQLConPool, QRY, PARAMS, cntxtDtls).catch(() => []);
};
