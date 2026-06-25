/**
 * Web Member Groups Model
 * Admin web console (djt-web) — member groups / cohorts.
 * No backing table yet — returns empty result sets; writes are no-ops.
 */

const sqldb = require(appRoot + '/config/db.config');
const dbutil = require(appRoot + '/utils/db.utils');
const cntxtDtls = "memberGroupsMdl";

/*****************************************************************************
* Function      : listMdl
* Description   : All member groups (no backing table yet).
******************************************************************************/
exports.listMdl = function() {
    // TODO: no member_group_lst_t table yet; return empty until one exists.
    return Promise.resolve([]);
};

/*****************************************************************************
* Function      : getByIdMdl
* Description   : Single member group by primary id (no backing table yet).
* Arguments     : data object with id
******************************************************************************/
exports.getByIdMdl = function(data) {
    // TODO: no member_group_lst_t table yet; return empty until one exists.
    return Promise.resolve([]);
};
