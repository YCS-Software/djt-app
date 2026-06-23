/**
 * OCPP Control Controller (REST)
 * Lets an owner monitor live charge points and send remote start/stop commands.
 */

const std = require(appRoot + '/utils/standardMessages');
const df = require(appRoot + '/utils/dateFormatUtil');
const ocppServer = require(appRoot + '/api/ocpp/ocppServer');
const cntxtDtls = "ocppCtrl";

function badRequest(res, message) {
    return res.status(std.message["BAD_REQUEST"].code).json({
        status: std.message["BAD_REQUEST"].code, message, data: null
    });
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

/* Remotely start a transaction on a connected charger */
exports.remoteStart = function(req, res) {
    const fnm = "remoteStart";
    const data = req.body.data || req.body;
    const ocppId = data.ocpp_id;
    const idToken = data.id_token;
    if (!ocppId || !idToken) return badRequest(res, 'ocpp_id and id_token are required');

    const conn = ocppServer.getConnection(ocppId);
    if (!conn) return badRequest(res, 'Charge point is not connected');

    const payload = {
        remoteStartId: Math.floor(Date.now() % 100000),
        idToken: { idToken: String(idToken), type: 'Central' },
    };
    if (data.evse_id) payload.evseId = Number(data.evse_id);

    ocppServer.sendCall(conn, 'RequestStartTransaction', payload)
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

    ocppServer.sendCall(conn, 'RequestStopTransaction', { transactionId: String(transactionId) })
        .then((result) => df.formatSucessRes(req, res, { result }, cntxtDtls, fnm, { message: 'Remote stop sent' }))
        .catch((error) => df.formatErrorRes(res, error, cntxtDtls, fnm, {}));
};
