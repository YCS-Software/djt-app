/**
 * Bulk Remote Controller (admin web console — djt-web)
 * Issues a bulk remote command to a set of stations. No-op execute for now —
 * echoes a confirmation message. Body: { action, stationIds:[] }.
 */

exports.execute = function (req, res) {
    const body = req.body || {};
    const action = body.action || 'command';
    const stationIds = Array.isArray(body.stationIds) ? body.stationIds : [];
    const n = stationIds.length;
    res.status(200).json({ status: 200, message: `"${action}" sent to ${n} station(s)` });
};
