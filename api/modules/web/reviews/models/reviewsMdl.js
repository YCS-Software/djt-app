/**
 * Reviews Model (web admin console)
 * Read-only SELECTs against the live `*_lst_t` schema. SELECT only.
 */

const sqldb = require(appRoot + '/config/db.config');
const dbutil = require(appRoot + '/utils/db.utils');
const cntxtDtls = "reviewsMdl";

/*****************************************************************************
* Function      : listMdl
* Description   : Driver reviews of charging stations.
******************************************************************************/
exports.listMdl = function() {
    const QRY_TO_EXEC = `SELECT r.rvw_id AS id, u.nm_tx AS user, s.sttn_nm_tx AS station, r.rtng_nbr AS rating, r.rvw_tx AS review, r.i_ts AS createdAt FROM rvw_lst_t r LEFT JOIN usr_lst_t u ON u.usr_id=r.usr_id LEFT JOIN sttn_lst_t s ON s.sttn_id=r.sttn_id ORDER BY r.rvw_id DESC`;

    console.log('[listMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};

/*****************************************************************************
* Function      : getByIdMdl
* Description   : Single review detail filtered by primary id column.
* Arguments     : data object with id
******************************************************************************/
exports.getByIdMdl = function(data) {
    const id = parseInt(data.id, 10) || 0;
    const QRY_TO_EXEC = `SELECT * FROM ( SELECT r.rvw_id AS id, u.nm_tx AS user, s.sttn_nm_tx AS station, r.rtng_nbr AS rating, r.rvw_tx AS review, r.i_ts AS createdAt FROM rvw_lst_t r LEFT JOIN usr_lst_t u ON u.usr_id=r.usr_id LEFT JOIN sttn_lst_t s ON s.sttn_id=r.sttn_id ORDER BY r.rvw_id DESC ) q WHERE q.id = ${id}`;

    console.log('[getByIdMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};
