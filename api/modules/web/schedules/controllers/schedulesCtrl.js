/**
 * Schedules Controller
 * Admin web console (djt-web) — scheduled charging bookings endpoints.
 */

const std = require(appRoot + '/utils/standardMessages');
const mdl = require('../models/schedulesMdl');

exports.list = function(req, res) {
    mdl.listMdl()
        .then(rows => res.status(200).json({ status: 200, rows: rows || [] }))
        .catch(e => { console.error('[schedules] list', e); res.status(500).json({ status: 500, error: 'Failed to load schedules' }); });
};

exports.get = function(req, res) {
    mdl.getByIdMdl({ id: req.params.id })
        .then(rows => res.status(200).json({ status: 200, row: (rows && rows[0]) || null }))
        .catch(e => { console.error('[schedules] get', e); res.status(500).json({ status: 500, error: 'Failed to load schedules' }); });
};
