/**
 * Web serverLogs Controller (admin web console — djt-web).
 */
const mdl = require('../models/serverLogsMdl');

exports.list = function (req, res) {
    mdl.listMdl()
        .then(rows => res.status(200).json({ status: 200, rows: rows || [] }))
        .catch(e => { console.error('[serverLogs] list', e); res.status(500).json({ status: 500, error: 'Failed to load logs' }); });
};
