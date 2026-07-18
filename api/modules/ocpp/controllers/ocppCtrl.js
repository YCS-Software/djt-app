/**
 * OCPP Control Controller (REST)
 * Lets an owner monitor live charge points and send remote start/stop commands.
 */

const std = require(appRoot + '/utils/standardMessages');
const df = require(appRoot + '/utils/dateFormatUtil');
const ocppServer = require(appRoot + '/api/ocpp/ocppServer');
const ocppLogMdl = require(appRoot + '/api/ocpp/ocppLogMdl');
const cntxtDtls = "ocppCtrl";

function badRequest(res, message) {
    return res.status(std.message["BAD_REQUEST"].code).json({
        status: std.message["BAD_REQUEST"].code, message, data: null
    });
}

// Send one CSMS->CP command to a connected charger and return its ack. Shared by
// all the owner "Charger Controls" operations (reset, clear cache, unlock, …).
// `connector_id` in these payloads is the OCPP connector number (1-based ordinal),
// consistent with remoteStart above.
function sendToCharger(req, res, fnm, ocppId, action, payload, okMsg) {
    if (!ocppId) return badRequest(res, 'ocpp_id is required');
    const conn = ocppServer.getConnection(ocppId);
    if (!conn) return badRequest(res, 'Charge point is not connected');
    return ocppServer.sendCall(conn, action, payload || {})
        .then((result) => df.formatSucessRes(req, res, { result }, cntxtDtls, fnm, { message: okMsg }))
        .catch((error) => df.formatErrorRes(res, error, cntxtDtls, fnm, {}));
}

/* List live-connected charge points */
exports.getConnections = function(req, res) {
    const fnm = "getConnections";
    try {
        return df.formatSucessRes(req, res, { connections: ocppServer.listConnections() }, cntxtDtls, fnm, {});
    } catch (error) {
        return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
    }
};

/* OCPP request/response audit log (for charger vendors / support) */
exports.getLogs = function(req, res) {
    const fnm = "getLogs";
    const q = req.query || {};
    ocppLogMdl.listOcppLogs({
        ocppId: q.ocpp_id,
        machineId: q.machine_id,
        action: q.action,
        direction: q.direction,
        messageId: q.message_id,
        limit: q.limit,
        offset: q.offset,
    })
        .then((logs) => df.formatSucessRes(req, res, { logs }, cntxtDtls, fnm, {}))
        .catch((error) => df.formatErrorRes(res, error, cntxtDtls, fnm, {}));
};

/* Remotely start a transaction on a connected charger */
exports.remoteStart = function(req, res) {
    const fnm = "remoteStart";
    const data = req.body.data || req.body;
    const ocppId = data.ocpp_id;
    const idToken = data.id_token;
    if (!ocppId || !idToken) return badRequest(res, 'ocpp_id and id_token are required');

    const conn = ocppServer.getConnection(ocppId);
    if (!conn) return badRequest(res, 'Charge point is not connected');

    // OCPP 1.6 RemoteStartTransaction: { idTag, connectorId? }
    const payload = { idTag: String(idToken) };
    if (data.connector_id || data.evse_id) payload.connectorId = Number(data.connector_id || data.evse_id);

    ocppServer.sendCall(conn, 'RemoteStartTransaction', payload)
        .then((result) => df.formatSucessRes(req, res, { result }, cntxtDtls, fnm, { message: 'Remote start sent' }))
        .catch((error) => df.formatErrorRes(res, error, cntxtDtls, fnm, {}));
};

/* Remotely stop a transaction on a connected charger */
exports.remoteStop = function(req, res) {
    const fnm = "remoteStop";
    const data = req.body.data || req.body;
    const ocppId = data.ocpp_id;
    const transactionId = data.transaction_id;
    if (!ocppId || !transactionId) return badRequest(res, 'ocpp_id and transaction_id are required');

    const conn = ocppServer.getConnection(ocppId);
    if (!conn) return badRequest(res, 'Charge point is not connected');

    // OCPP 1.6 RemoteStopTransaction: { transactionId } (integer)
    ocppServer.sendCall(conn, 'RemoteStopTransaction', { transactionId: Number(transactionId) || transactionId })
        .then((result) => df.formatSucessRes(req, res, { result }, cntxtDtls, fnm, { message: 'Remote stop sent' }))
        .catch((error) => df.formatErrorRes(res, error, cntxtDtls, fnm, {}));
};

/* ---- Charger Controls (owner remote operations) ---- */

/* Reset a charger. type: 'Soft' (graceful) | 'Hard' (full reboot). */
exports.reset = function(req, res) {
    const data = req.body.data || req.body;
    const type = data.type === 'Hard' ? 'Hard' : 'Soft';
    return sendToCharger(req, res, 'reset', data.ocpp_id, 'Reset', { type }, `${type} reset sent`);
};

/* Clear the charger's local authorization cache. */
exports.clearCache = function(req, res) {
    const data = req.body.data || req.body;
    return sendToCharger(req, res, 'clearCache', data.ocpp_id, 'ClearCache', {}, 'Clear cache sent');
};

/* Unlock a connector (release a stuck cable). connector_id = OCPP ordinal (1-based). */
exports.unlockConnector = function(req, res) {
    const data = req.body.data || req.body;
    const connectorId = Number(data.connector_id);
    if (!connectorId) return badRequest(res, 'connector_id is required');
    return sendToCharger(req, res, 'unlockConnector', data.ocpp_id, 'UnlockConnector', { connectorId }, 'Unlock connector sent');
};

/* Take a connector (or the whole charger, connector_id 0) in/out of service. */
exports.changeAvailability = function(req, res) {
    const data = req.body.data || req.body;
    const type = data.type === 'Inoperative' ? 'Inoperative' : 'Operative';
    const connectorId = data.connector_id != null ? Number(data.connector_id) : 0;
    return sendToCharger(req, res, 'changeAvailability', data.ocpp_id, 'ChangeAvailability', { connectorId, type }, `Set ${type} sent`);
};

/* Ask the charger to (re)send a message — default a fresh StatusNotification. */
exports.triggerMessage = function(req, res) {
    const data = req.body.data || req.body;
    const requestedMessage = data.requested_message || 'StatusNotification';
    const payload = { requestedMessage };
    if (data.connector_id != null && Number(data.connector_id) > 0) payload.connectorId = Number(data.connector_id);
    return sendToCharger(req, res, 'triggerMessage', data.ocpp_id, 'TriggerMessage', payload, `Trigger ${requestedMessage} sent`);
};

/* Read the charger's configuration keys (optionally a subset). The OCPP response
   itself carries { configurationKey, unknownKey } — returned as-is to the app. */
exports.getConfiguration = function(req, res) {
    const data = req.body.data || req.body;
    const keys = Array.isArray(data.keys) ? data.keys.filter(Boolean).map(String) : null;
    const payload = keys && keys.length ? { key: keys } : {};
    return sendToCharger(req, res, 'getConfiguration', data.ocpp_id, 'GetConfiguration', payload, 'Configuration retrieved');
};

/* Ask the charger to upload a diagnostics log to a location URL. */
exports.getDiagnostics = function(req, res) {
    const data = req.body.data || req.body;
    const location = data.location && String(data.location).trim();
    if (!location) return badRequest(res, 'A diagnostics upload location URL is required');
    const payload = { location };
    if (data.retries != null) payload.retries = Number(data.retries);
    if (data.retry_interval != null) payload.retryInterval = Number(data.retry_interval);
    if (data.start_time) payload.startTime = String(data.start_time);
    if (data.stop_time) payload.stopTime = String(data.stop_time);
    return sendToCharger(req, res, 'getDiagnostics', data.ocpp_id, 'GetDiagnostics', payload, 'Diagnostics upload requested');
};

/* Push an OTA firmware update from a location URL. */
exports.updateFirmware = function(req, res) {
    const data = req.body.data || req.body;
    const location = data.location && String(data.location).trim();
    if (!location) return badRequest(res, 'A firmware file URL is required');
    const payload = { location, retrieveDate: data.retrieve_date ? String(data.retrieve_date) : new Date().toISOString() };
    if (data.retries != null) payload.retries = Number(data.retries);
    if (data.retry_interval != null) payload.retryInterval = Number(data.retry_interval);
    return sendToCharger(req, res, 'updateFirmware', data.ocpp_id, 'UpdateFirmware', payload, 'Firmware update requested');
};
