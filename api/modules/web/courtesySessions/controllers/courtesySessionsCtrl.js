/**
 * Web Courtesy Sessions Controller
 * Admin web console (djt-web) — complimentary / courtesy charging sessions.
 * No backing table yet — list returns []; writes are no-ops.
 */

const std = require(appRoot + '/utils/standardMessages');
const mdl = require('../models/courtesySessionsMdl');

exports.list = function(req, res) {
    mdl.listMdl()
        .then(rows => res.status(200).json({ status: 200, rows: rows || [] }))
        .catch(e => { console.error('[courtesySessions] list', e); res.status(500).json({ status: 500, error: 'Failed to load courtesy sessions' }); });
};

exports.get = function(req, res) {
    mdl.getByIdMdl({ id: req.params.id })
        .then(rows => res.status(200).json({ status: 200, row: (rows && rows[0]) || null }))
        .catch(e => { console.error('[courtesySessions] get', e); res.status(500).json({ status: 500, error: 'Failed to load courtesy sessions' }); });
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
