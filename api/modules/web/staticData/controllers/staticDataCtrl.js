/**
 * Static Data Controller
 * Admin web console (djt-web) — system lookup / static reference data.
 * Read-only (backed by sttng_lst_t); writes are no-op.
 */

const mdl = require('../models/staticDataMdl');

exports.list = function(req, res) {
    mdl.listMdl()
        .then(rows => res.status(200).json({ status: 200, rows: rows || [] }))
        .catch(e => { console.error('[staticData] list', e); res.status(500).json({ status: 500, error: 'Failed to load static data' }); });
};

exports.get = function(req, res) {
    mdl.getByIdMdl({ id: req.params.id })
        .then(rows => res.status(200).json({ status: 200, row: (rows && rows[0]) || null }))
        .catch(e => { console.error('[staticData] get', e); res.status(500).json({ status: 500, error: 'Failed to load static data' }); });
};

exports.create = function(req, res) {
    res.status(200).json({ status: 200, message: 'Static data is read-only' });
};

exports.update = function(req, res) {
    res.status(200).json({ status: 200, message: 'Static data is read-only' });
};

exports.delete = function(req, res) {
    res.status(200).json({ status: 200, message: 'Static data is read-only' });
};
