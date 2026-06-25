/**
 * Web Subscriptions Model
 * Admin web console (djt-web) — subscription plans.
 * No backing table yet — returns empty result sets; writes are no-ops.
 */

const sqldb = require(appRoot + '/config/db.config');
const dbutil = require(appRoot + '/utils/db.utils');
const cntxtDtls = "subscriptionsMdl";

/*****************************************************************************
* Function      : listMdl
* Description   : All subscription plans (no backing table yet).
******************************************************************************/
exports.listMdl = function() {
    // TODO: no subscription_lst_t table yet; return empty until one exists.
    return Promise.resolve([]);
};

/*****************************************************************************
* Function      : getByIdMdl
* Description   : Single subscription plan by primary id (no backing table yet).
* Arguments     : data object with id
******************************************************************************/
exports.getByIdMdl = function(data) {
    // TODO: no subscription_lst_t table yet; return empty until one exists.
    return Promise.resolve([]);
};
