/**
 * Users Controller (admin web console — djt-web)
 */

const std = require(appRoot + '/utils/standardMessages');
const mdl = require('../models/usersMdl');
const audit = require(appRoot + '/utils/auditUtil');

exports.list = function (req, res) {
    mdl.listMdl()
        .then(rows => res.status(200).json({ status: 200, rows: rows || [] }))
        .catch(e => { console.error('[users] list', e); res.status(500).json({ status: 500, error: 'Failed to load users' }); });
};

exports.get = function (req, res) {
    mdl.getByIdMdl({ id: req.params.id })
        .then(rows => res.status(200).json({ status: 200, row: (rows && rows[0]) || null }))
        .catch(e => { console.error('[users] get', e); res.status(500).json({ status: 500, error: 'Failed to load users' }); });
};

exports.create = function (req, res) {
    const body = req.body || {};
    mdl.createMdl(body)
        .then(result => {
            const ctx = audit.reqCtx(req);
            audit.writeAudit({ userId: ctx.userId, action: 'user_create', entityType: 'user', entityId: result && result.insertId, newVal: { name: body.name, email: body.email, phone: body.phone, role: body.role }, ip: ctx.ip, userAgent: ctx.userAgent });
            res.status(200).json({ status: 200, message: 'User created' });
        })
        .catch(e => { console.error('[users] create', e); res.status(500).json({ status: 500, error: 'Failed to create user' }); });
};

exports.update = function (req, res) {
    const data = Object.assign({}, req.body || {}, { id: req.params.id });
    mdl.updateMdl(data)
        .then(() => {
            const ctx = audit.reqCtx(req);
            audit.writeAudit({ userId: ctx.userId, action: 'user_update', entityType: 'user', entityId: req.params.id, newVal: { name: data.name, email: data.email, phone: data.phone, role: data.role }, ip: ctx.ip, userAgent: ctx.userAgent });
            res.status(200).json({ status: 200, message: 'User updated' });
        })
        .catch(e => { console.error('[users] update', e); res.status(500).json({ status: 500, error: 'Failed to update user' }); });
};

exports.delete = function (req, res) {
    mdl.deleteMdl({ id: req.params.id })
        .then(() => {
            const ctx = audit.reqCtx(req);
            audit.writeAudit({ userId: ctx.userId, action: 'user_delete', entityType: 'user', entityId: req.params.id, ip: ctx.ip, userAgent: ctx.userAgent });
            res.status(200).json({ status: 200, message: 'User deleted' });
        })
        .catch(e => { console.error('[users] delete', e); res.status(500).json({ status: 500, error: 'Failed to delete user' }); });
};
