/**
 * Instructions Controller
 * Admin web console (djt-web) — instruction documents (no backing table yet).
 */

const mdl = require('../models/instructionsMdl');

exports.list = function(req, res) {
    mdl.listMdl()
        .then(rows => res.status(200).json({ status: 200, rows: rows || [] }))
        .catch(e => { console.error('[instructions] list', e); res.status(500).json({ status: 500, error: 'Failed to load instructions' }); });
};

exports.get = function(req, res) {
    mdl.getByIdMdl({ id: req.params.id })
        .then(rows => res.status(200).json({ status: 200, row: (rows && rows[0]) || null }))
        .catch(e => { console.error('[instructions] get', e); res.status(500).json({ status: 500, error: 'Failed to load instructions' }); });
};

exports.create = function(req, res) {
    res.status(200).json({ status: 200, message: 'No-op (no backing table yet)' });
};

exports.update = function(req, res) {
    res.status(200).json({ status: 200, message: 'No-op (no backing table yet)' });
};

exports.delete = function(req, res) {
    res.status(200).json({ status: 200, message: 'No-op (no backing table yet)' });
};
