/**
 * Partners Controller
 * Admin web console (djt-web) — partner organizations (station owners).
 */

const std = require(appRoot + '/utils/standardMessages');
const mdl = require('../models/partnersMdl');
const audit = require(appRoot + '/utils/auditUtil');

exports.list = function(req, res) {
    mdl.listMdl()
        .then(rows => res.status(200).json({ status: 200, rows: rows || [] }))
        .catch(e => { console.error('[partners] list', e); res.status(500).json({ status: 500, error: 'Failed to load partners' }); });
};

exports.get = function(req, res) {
    mdl.getByIdMdl({ id: req.params.id })
        .then(rows => res.status(200).json({ status: 200, row: (rows && rows[0]) || null }))
        .catch(e => { console.error('[partners] get', e); res.status(500).json({ status: 500, error: 'Failed to load partners' }); });
};

exports.create = function(req, res) {
    const body = req.body || {};
    mdl.createMdl(body)
        .then(result => {
            const ctx = audit.reqCtx(req);
            audit.writeAudit({ userId: ctx.userId, action: 'partner_create', entityType: 'partner', entityId: result && result.insertId, newVal: { name: body.name, email: body.email, phone: body.phone, status: body.status }, ip: ctx.ip, userAgent: ctx.userAgent });
            res.status(200).json({ status: 200, message: 'Partner created' });
        })
        .catch(e => { console.error('[partners] create', e); res.status(500).json({ status: 500, error: 'Failed to create partner' }); });
};

exports.update = function(req, res) {
    const data = Object.assign({}, req.body || {}, { id: req.params.id });
    mdl.updateMdl(data)
        .then(() => {
            const ctx = audit.reqCtx(req);
            audit.writeAudit({ userId: ctx.userId, action: 'partner_update', entityType: 'partner', entityId: req.params.id, newVal: { name: data.name, email: data.email, phone: data.phone, status: data.status }, ip: ctx.ip, userAgent: ctx.userAgent });
            res.status(200).json({ status: 200, message: 'Partner updated' });
        })
        .catch(e => { console.error('[partners] update', e); res.status(500).json({ status: 500, error: 'Failed to update partner' }); });
};

exports.delete = function(req, res) {
    mdl.deleteMdl({ id: req.params.id })
        .then(() => {
            const ctx = audit.reqCtx(req);
            audit.writeAudit({ userId: ctx.userId, action: 'partner_delete', entityType: 'partner', entityId: req.params.id, ip: ctx.ip, userAgent: ctx.userAgent });
            res.status(200).json({ status: 200, message: 'Partner deleted' });
        })
        .catch(e => { console.error('[partners] delete', e); res.status(500).json({ status: 500, error: 'Failed to delete partner' }); });
};
