/**
 * Smart Scheduling Model (admin web console — djt-web)
 * No backing table exists for smart-scheduling yet — list returns empty.
 * Grid fields: name, stationName, startTime, endTime, maxPower, status.
 */

// const sqldb = require(appRoot + '/config/db.config');
// const dbutil = require(appRoot + '/utils/db.utils');
// const cntxtDtls = "smartSchedulingMdl";

/*****************************************************************************
* Function      : listMdl
* Description   : Smart scheduling rules — no backing table yet.
******************************************************************************/
exports.listMdl = function () {
    // TODO: back with a real schedule-rules table when one exists.
    return Promise.resolve([]);
};

/*****************************************************************************
* Function      : getByIdMdl
* Description   : No backing table yet.
******************************************************************************/
exports.getByIdMdl = function () {
    // TODO: back with a real schedule-rules table when one exists.
    return Promise.resolve([]);
};
