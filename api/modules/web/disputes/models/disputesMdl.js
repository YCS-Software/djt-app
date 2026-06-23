/**
 * Web Disputes Model
 * Admin web console (djt-web) — customer disputes and resolutions.
 * No backing table — returns empty result sets.
 */

const sqldb = require(appRoot + '/config/db.config');
const dbutil = require(appRoot + '/utils/db.utils');
const cntxtDtls = "disputesMdl";

/*****************************************************************************
* Function      : listMdl
* Description   : All disputes (no backing table).
******************************************************************************/
exports.listMdl = function() {
    return Promise.resolve([]);
};

/*****************************************************************************
* Function      : getByIdMdl
* Description   : Single dispute by primary id (no backing table).
* Arguments     : data object with id
******************************************************************************/
exports.getByIdMdl = function(data) {
    return Promise.resolve([]);
};
