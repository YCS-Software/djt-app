/**
 * Products Controller
 * Admin web console (djt-web) — product catalog (no backing table yet).
 */

const mdl = require('../models/productsMdl');

exports.list = function(req, res) {
    mdl.listMdl()
        .then(rows => res.status(200).json({ status: 200, rows: rows || [] }))
        .catch(e => { console.error('[products] list', e); res.status(500).json({ status: 500, error: 'Failed to load products' }); });
};

exports.get = function(req, res) {
    mdl.getByIdMdl({ id: req.params.id })
        .then(rows => res.status(200).json({ status: 200, row: (rows && rows[0]) || null }))
        .catch(e => { console.error('[products] get', e); res.status(500).json({ status: 500, error: 'Failed to load products' }); });
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
