/**
 * Live Sessions Controller (admin web console — djt-web)
 * Read-only list of active sessions over `sssn_lst_t`. Stop is a no-op command
 * for now (real remote-stop is handled by the stations remote endpoints).
 */

const mdl = require('../models/liveSessionsMdl');

exports.list = function (req, res) {
    mdl.listMdl()
        .then(rows => res.status(200).json({ status: 200, rows: rows || [] }))
        .catch(e => { console.error('[liveSessions] list', e); res.status(500).json({ status: 500, error: 'Failed to load live sessions' }); });
};

exports.stop = function (req, res) {
    const id = parseInt(req.params.id, 10) || 0;
    res.status(200).json({ status: 200, message: `Stop signal sent to session ${id}` });
};
