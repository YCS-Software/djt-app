/**
 * Web Tariffs Model
 * Admin web console (djt-web) — pricing / tariff plans.
 * No backing table in the live schema yet (no tarf/trff/*_lst_t table);
 * returns empty result sets until one exists. Writes are no-ops.
 */

const sqldb = require(appRoot + '/config/db.config');
const dbutil = require(appRoot + '/utils/db.utils');
const cntxtDtls = "tariffsMdl";

/*****************************************************************************
* Function      : listMdl
* Description   : All tariff plans (no backing table yet).
******************************************************************************/
exports.listMdl = function() {
    // TODO: no tariff *_lst_t table yet; return empty until one exists.
    return Promise.resolve([]);
};

/*****************************************************************************
* Function      : getByIdMdl
* Description   : Single tariff plan by primary id (no backing table yet).
* Arguments     : data object with id
******************************************************************************/
exports.getByIdMdl = function(data) {
    return Promise.resolve([]);
};
