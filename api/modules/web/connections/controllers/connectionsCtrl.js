/**
 * Connections Controller (admin web console — djt-web)
 * Read-only charger heartbeat view over `mchn_lst_t`.
 */

const mdl = require('../models/connectionsMdl');

exports.list = function (req, res) {
    mdl.listMdl()
        .then(rows => res.status(200).json({ status: 200, rows: rows || [] }))
        .catch(e => { console.error('[connections] list', e); res.status(500).json({ status: 500, error: 'Failed to load connections' }); });
};

exports.get = function (req, res) {
    mdl.getByIdMdl({ id: req.params.id })
        .then(rows => res.status(200).json({ status: 200, row: (rows && rows[0]) || null }))
        .catch(e => { console.error('[connections] get', e); res.status(500).json({ status: 500, error: 'Failed to load connection' }); });
};

exports.create = function (req, res) {
    res.status(200).json({ status: 200, message: 'No-op (connections are read-only)' });
};

exports.update = function (req, res) {
    res.status(200).json({ status: 200, message: 'No-op (connections are read-only)' });
};

exports.delete = function (req, res) {
    res.status(200).json({ status: 200, message: 'No-op (connections are read-only)' });
};
