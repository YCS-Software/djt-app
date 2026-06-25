/**
 * Web Businesses Model
 * Admin web console (djt-web) — business organisations.
 * No dedicated business table in the live schema yet — returns empty result
 * sets; writes are no-ops. (Owners/partners live in usr_lst_t.)
 */

const sqldb = require(appRoot + '/config/db.config');
const dbutil = require(appRoot + '/utils/db.utils');
const cntxtDtls = "businessesMdl";

/*****************************************************************************
* Function      : listMdl
* Description   : All business organisations (no backing table yet).
******************************************************************************/
exports.listMdl = function () {
    // TODO: no business_lst_t table yet; return empty until one exists.
    return Promise.resolve([]);
};

/*****************************************************************************
* Function      : getByIdMdl
* Description   : Single business organisation by id (no backing table yet).
******************************************************************************/
exports.getByIdMdl = function (data) {
    // TODO: no business_lst_t table yet; return empty until one exists.
    return Promise.resolve([]);
};
