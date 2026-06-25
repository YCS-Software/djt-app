/**
 * CDR Controller (admin web console — djt-web)
 * Charge Detail Records — read-only over `sssn_lst_t`.
 */

const mdl = require('../models/cdrMdl');

exports.list = function (req, res) {
    mdl.listMdl()
        .then(rows => res.status(200).json({ status: 200, rows: rows || [] }))
        .catch(e => { console.error('[cdr] list', e); res.status(500).json({ status: 500, error: 'Failed to load CDRs' }); });
};

exports.get = function (req, res) {
    mdl.getByIdMdl({ id: req.params.id })
        .then(rows => res.status(200).json({ status: 200, row: (rows && rows[0]) || null }))
        .catch(e => { console.error('[cdr] get', e); res.status(500).json({ status: 500, error: 'Failed to load CDR' }); });
};

// No backing write semantics for CDRs (records derive from sessions).
exports.create = function (req, res) {
    res.status(200).json({ status: 200, message: 'No-op (CDRs are read-only)' });
};

exports.update = function (req, res) {
    res.status(200).json({ status: 200, message: 'No-op (CDRs are read-only)' });
};

exports.delete = function (req, res) {
    res.status(200).json({ status: 200, message: 'No-op (CDRs are read-only)' });
};
