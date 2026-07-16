/**
 * Stations Controller (web admin console)
 */

const std = require(appRoot + '/utils/standardMessages');
const mdl = require('../models/stationsMdl');

exports.list = function(req, res) {
    mdl.listMdl()
        .then(rows => res.status(200).json({ status: 200, rows: rows || [] }))
        .catch(e => { console.error('[stations] list', e); res.status(500).json({ status: 500, error: 'Failed to load stations' }); });
};

exports.get = function(req, res) {
    mdl.getByIdMdl({ id: req.params.id })
        .then(rows => res.status(200).json({ status: 200, row: (rows && rows[0]) || null }))
        .catch(e => { console.error('[stations] get', e); res.status(500).json({ status: 500, error: 'Failed to load stations' }); });
};

exports.summary = function(req, res) {
    mdl.summaryMdl()
        .then(rows => {
            const r = (rows && rows[0]) || {};
            const totalConsumption = +Number(r.totalConsumption || 0).toFixed(2);
            const totalAmount = +Number(r.totalAmount || 0).toFixed(2);
            const totalEnergyPrice = +Number(r.totalEnergyPrice || 0).toFixed(2);
            // Tax = amount (with taxes) − energy price; never negative.
            const totalTax = +Math.max(0, totalAmount - totalEnergyPrice).toFixed(2);
            res.status(200).json({ status: 200, totalConsumption, totalAmount, totalEnergyPrice, totalTax });
        })
        .catch(e => { console.error('[stations] summary', e); res.status(500).json({ status: 500, error: 'Failed to load station summary' }); });
};

exports.create = function(req, res) {
    const b = req.body || {};
    if (!b.stationId || !b.name) {
        return res.status(400).json({ status: 400, error: 'stationId and name are required' });
    }
    mdl.createMdl(b)
        .then(r => res.status(201).json({ status: 201, id: r && r.insertId, message: 'Charger created' }))
        .catch(e => { console.error('[stations] create', e); res.status(500).json({ status: 500, error: e.err_message || 'Failed to create charger' }); });
};
