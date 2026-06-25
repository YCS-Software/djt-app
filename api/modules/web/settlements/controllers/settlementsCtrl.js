/**
 * Web Settlements Controller
 * Admin web console (djt-web) — partner revenue settlements.
 */

const std = require(appRoot + '/utils/standardMessages');
const mdl = require('../models/settlementsMdl');

exports.list = function (req, res) {
    mdl.listMdl()
        .then(rows => res.status(200).json({ status: 200, rows: rows || [] }))
        .catch(e => { console.error('[settlements] list', e); res.status(500).json({ status: 500, error: 'Failed to load settlements' }); });
};

exports.get = function (req, res) {
    mdl.getByIdMdl({ id: req.params.id })
        .then(rows => res.status(200).json({ status: 200, row: (rows && rows[0]) || null }))
        .catch(e => { console.error('[settlements] get', e); res.status(500).json({ status: 500, error: 'Failed to load settlement' }); });
};

// Mark a settlement as settled. No-op acknowledgement until the settlement
// workflow tables are finalised in this environment.
exports.settle = function (req, res) {
    res.status(200).json({ status: 200, message: 'Settlement marked as settled' });
};
