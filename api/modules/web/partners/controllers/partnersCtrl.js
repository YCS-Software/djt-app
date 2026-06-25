/**
 * Partners Controller
 * Admin web console (djt-web) — partner organizations (station owners).
 */

const std = require(appRoot + '/utils/standardMessages');
const mdl = require('../models/partnersMdl');

exports.list = function(req, res) {
    mdl.listMdl()
        .then(rows => res.status(200).json({ status: 200, rows: rows || [] }))
        .catch(e => { console.error('[partners] list', e); res.status(500).json({ status: 500, error: 'Failed to load partners' }); });
};

exports.get = function(req, res) {
    mdl.getByIdMdl({ id: req.params.id })
        .then(rows => res.status(200).json({ status: 200, row: (rows && rows[0]) || null }))
        .catch(e => { console.error('[partners] get', e); res.status(500).json({ status: 500, error: 'Failed to load partners' }); });
};

exports.create = function(req, res) {
    mdl.createMdl(req.body || {})
        .then(() => res.status(200).json({ status: 200, message: 'Partner created' }))
        .catch(e => { console.error('[partners] create', e); res.status(500).json({ status: 500, error: 'Failed to create partner' }); });
};

exports.update = function(req, res) {
    const data = Object.assign({}, req.body || {}, { id: req.params.id });
    mdl.updateMdl(data)
        .then(() => res.status(200).json({ status: 200, message: 'Partner updated' }))
        .catch(e => { console.error('[partners] update', e); res.status(500).json({ status: 500, error: 'Failed to update partner' }); });
};

exports.delete = function(req, res) {
    mdl.deleteMdl({ id: req.params.id })
        .then(() => res.status(200).json({ status: 200, message: 'Partner deleted' }))
        .catch(e => { console.error('[partners] delete', e); res.status(500).json({ status: 500, error: 'Failed to delete partner' }); });
};
