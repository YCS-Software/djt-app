/**
 * Locations Controller
 * Admin web console (djt-web) — charging site locations endpoints.
 */

const std = require(appRoot + '/utils/standardMessages');
const mdl = require('../models/locationsMdl');
const audit = require(appRoot + '/utils/auditUtil');

exports.list = function(req, res) {
    mdl.listMdl()
        .then(rows => res.status(200).json({ status: 200, rows: rows || [] }))
        .catch(e => { console.error('[locations] list', e); res.status(500).json({ status: 500, error: 'Failed to load locations' }); });
};

exports.get = function(req, res) {
    mdl.getByIdMdl({ id: req.params.id })
        .then(rows => res.status(200).json({ status: 200, row: (rows && rows[0]) || null }))
        .catch(e => { console.error('[locations] get', e); res.status(500).json({ status: 500, error: 'Failed to load locations' }); });
};

exports.create = function(req, res) {
    const body = req.body || {};
    mdl.createMdl(body)
        .then(result => {
            const ctx = audit.reqCtx(req);
            audit.writeAudit({ userId: ctx.userId, action: 'location_create', entityType: 'location', entityId: result && result.insertId, newVal: { name: body.name, address: body.address, status: body.status }, ip: ctx.ip, userAgent: ctx.userAgent });
            res.status(200).json({ status: 200, message: 'Location created' });
        })
        .catch(e => { console.error('[locations] create', e); res.status(500).json({ status: 500, error: 'Failed to create location' }); });
};

exports.update = function(req, res) {
    const data = Object.assign({}, req.body || {}, { id: req.params.id });
    mdl.updateMdl(data)
        .then(() => {
            const ctx = audit.reqCtx(req);
            audit.writeAudit({ userId: ctx.userId, action: 'location_update', entityType: 'location', entityId: req.params.id, newVal: { name: data.name, address: data.address, status: data.status }, ip: ctx.ip, userAgent: ctx.userAgent });
            res.status(200).json({ status: 200, message: 'Location updated' });
        })
        .catch(e => { console.error('[locations] update', e); res.status(500).json({ status: 500, error: 'Failed to update location' }); });
};

exports.delete = function(req, res) {
    mdl.deleteMdl({ id: req.params.id })
        .then(() => {
            const ctx = audit.reqCtx(req);
            audit.writeAudit({ userId: ctx.userId, action: 'location_delete', entityType: 'location', entityId: req.params.id, ip: ctx.ip, userAgent: ctx.userAgent });
            res.status(200).json({ status: 200, message: 'Location deleted' });
        })
        .catch(e => { console.error('[locations] delete', e); res.status(500).json({ status: 500, error: 'Failed to delete location' }); });
};
