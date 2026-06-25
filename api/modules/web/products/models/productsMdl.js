/**
 * Products Model
 * Admin web console (djt-web) — product catalog / linked products.
 * No backing table exists in the live `*_lst_t` schema, so the list returns
 * an empty result set (HARD RULE: never reference a non-existent table).
 * Columns the grid expects: id, name, category, url, status.
 */

// const sqldb = require(appRoot + '/config/db.config');
// const dbutil = require(appRoot + '/utils/db.utils');
// const cntxtDtls = "productsMdl";

/*****************************************************************************
* Function      : listMdl
* Description   : No backing table yet — return empty.
******************************************************************************/
exports.listMdl = function() {
    // TODO: wire to a real products table when the schema adds one.
    return Promise.resolve([]);
};

/*****************************************************************************
* Function      : getByIdMdl
* Description   : No backing table yet — return empty.
******************************************************************************/
exports.getByIdMdl = function(/* data */) {
    // TODO: wire to a real products table when the schema adds one.
    return Promise.resolve([]);
};
