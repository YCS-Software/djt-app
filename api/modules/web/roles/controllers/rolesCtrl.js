/**
 * Roles Controller
 * Admin web console (djt-web) — roles derived from usr_lst_t.usr_typ_cd.
 * Read-only; role create/update/delete are no-op (roles are derived).
 */

const mdl = require('../models/rolesMdl');

exports.list = function(req, res) {
    mdl.listMdl()
        .then(rows => res.status(200).json({ status: 200, rows: rows || [] }))
        .catch(e => { console.error('[roles] list', e); res.status(500).json({ status: 500, error: 'Failed to load roles' }); });
};

exports.get = function(req, res) {
    mdl.getByIdMdl({ id: req.params.id })
        .then(rows => res.status(200).json({ status: 200, row: (rows && rows[0]) || null }))
        .catch(e => { console.error('[roles] get', e); res.status(500).json({ status: 500, error: 'Failed to load roles' }); });
};

exports.create = function(req, res) {
    res.status(200).json({ status: 200, message: 'Roles are derived from users (read-only)' });
};

exports.update = function(req, res) {
    res.status(200).json({ status: 200, message: 'Roles are derived from users (read-only)' });
};

exports.delete = function(req, res) {
    res.status(200).json({ status: 200, message: 'Roles are derived from users (read-only)' });
};
