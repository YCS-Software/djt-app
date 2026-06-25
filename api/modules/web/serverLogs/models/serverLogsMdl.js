/**
 * Web serverLogs Model (admin web console — djt-web).
 * No dedicated log table wired yet — returns empty result sets.
 */
const sqldb = require(appRoot + '/config/db.config');
const dbutil = require(appRoot + '/utils/db.utils');
const cntxtDtls = "serverLogsMdl";

exports.listMdl = function () {
    // TODO: wire to the live log table when finalised.
    return Promise.resolve([]);
};
