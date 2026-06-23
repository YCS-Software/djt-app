/**
 * Web Reports Controller
 * Admin web console (djt-web) — revenue, energy and session reports by station.
 */

const std = require(appRoot + '/utils/standardMessages');
const mdl = require('../models/reportsMdl');

exports.list = function(req, res) {
    mdl.listMdl()
        .then(rows => res.status(200).json({ status: 200, rows: rows || [] }))
        .catch(e => { console.error('[reports] list', e); res.status(500).json({ status: 500, error: 'Failed to load reports' }); });
};

exports.get = function(req, res) {
    mdl.getByIdMdl({ id: req.params.id })
        .then(rows => res.status(200).json({ status: 200, row: (rows && rows[0]) || null }))
        .catch(e => { console.error('[reports] get', e); res.status(500).json({ status: 500, error: 'Failed to load reports' }); });
};
