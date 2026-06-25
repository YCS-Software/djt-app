/**
 * Web Courtesy Sessions Model
 * Admin web console (djt-web) — complimentary / courtesy charging sessions.
 * No backing table yet — returns empty result sets; writes are no-ops.
 */

const sqldb = require(appRoot + '/config/db.config');
const dbutil = require(appRoot + '/utils/db.utils');
const cntxtDtls = "courtesySessionsMdl";

/*****************************************************************************
* Function      : listMdl
* Description   : All courtesy sessions (no backing table yet).
******************************************************************************/
exports.listMdl = function() {
    // TODO: no courtesy_session_lst_t table yet; return empty until one exists.
    return Promise.resolve([]);
};

/*****************************************************************************
* Function      : getByIdMdl
* Description   : Single courtesy session by primary id (no backing table yet).
* Arguments     : data object with id
******************************************************************************/
exports.getByIdMdl = function(data) {
    // TODO: no courtesy_session_lst_t table yet; return empty until one exists.
    return Promise.resolve([]);
};
