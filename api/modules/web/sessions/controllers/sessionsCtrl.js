/**
 * Web Sessions Controller
 * Admin web console (djt-web) — charging sessions list & detail.
 */

const std = require(appRoot + '/utils/standardMessages');
const mdl = require('../models/sessionsMdl');

exports.list = function(req, res) {
    mdl.listMdl()
        .then(rows => res.status(200).json({ status: 200, rows: rows || [] }))
        .catch(e => { console.error('[sessions] list', e); res.status(500).json({ status: 500, error: 'Failed to load sessions' }); });
};

exports.get = function(req, res) {
    mdl.getByIdMdl({ id: req.params.id })
        .then(rows => res.status(200).json({ status: 200, row: (rows && rows[0]) || null }))
        .catch(e => { console.error('[sessions] get', e); res.status(500).json({ status: 500, error: 'Failed to load session' }); });
};
