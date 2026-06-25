/**
 * Web Agents Model
 * Admin web console (djt-web) — field / support agents.
 * No backing table yet — returns empty result sets; writes are no-ops.
 */

const sqldb = require(appRoot + '/config/db.config');
const dbutil = require(appRoot + '/utils/db.utils');
const cntxtDtls = "agentsMdl";

/*****************************************************************************
* Function      : listMdl
* Description   : All agents (no backing table yet).
******************************************************************************/
exports.listMdl = function() {
    // TODO: no agent_lst_t table yet; return empty until one exists.
    return Promise.resolve([]);
};

/*****************************************************************************
* Function      : getByIdMdl
* Description   : Single agent by primary id (no backing table yet).
* Arguments     : data object with id
******************************************************************************/
exports.getByIdMdl = function(data) {
    // TODO: no agent_lst_t table yet; return empty until one exists.
    return Promise.resolve([]);
};
