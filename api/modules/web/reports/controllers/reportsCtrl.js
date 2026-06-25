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

// Report builder metadata: available report types, their columns, and filter options.
exports.meta = function(req, res) {
    try {
        res.status(200).json({ status: 200, reports: mdl.reportMeta() });
    } catch (e) {
        console.error('[reports] meta', e);
        res.status(500).json({ status: 500, error: 'Failed to load report metadata' });
    }
};

// Generate a report: ?type=&startDate=&endDate=&filter= -> { columns, rows }.
exports.generate = function(req, res) {
    const { type, startDate, endDate, filter } = req.query;
    mdl.generateReportMdl({ type, startDate, endDate, filter })
        .then(rows => res.status(200).json({
            status: 200,
            type,
            columns: mdl.columnsFor(type),
            rows: rows || [],
        }))
        .catch(e => {
            console.error('[reports] generate', e);
            res.status(400).json({ status: 400, error: e.err_message || 'Failed to generate report' });
        });
};
