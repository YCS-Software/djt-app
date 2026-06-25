/**
 * Downtime Controller (admin web console — djt-web)
 * Read-only view derived from `mchn_lst_t` (status != available).
 */

const mdl = require('../models/downtimeMdl');

exports.list = function (req, res) {
    mdl.listMdl()
        .then(rows => res.status(200).json({ status: 200, rows: rows || [] }))
        .catch(e => { console.error('[downtime] list', e); res.status(500).json({ status: 500, error: 'Failed to load downtime' }); });
};

exports.get = function (req, res) {
    mdl.getByIdMdl({ id: req.params.id })
        .then(rows => res.status(200).json({ status: 200, row: (rows && rows[0]) || null }))
        .catch(e => { console.error('[downtime] get', e); res.status(500).json({ status: 500, error: 'Failed to load downtime' }); });
};

exports.create = function (req, res) {
    res.status(200).json({ status: 200, message: 'No-op (downtime is derived)' });
};

exports.update = function (req, res) {
    res.status(200).json({ status: 200, message: 'No-op (downtime is derived)' });
};

exports.delete = function (req, res) {
    res.status(200).json({ status: 200, message: 'No-op (downtime is derived)' });
};
