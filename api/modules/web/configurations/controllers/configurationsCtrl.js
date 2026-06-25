/**
 * Configurations Controller
 * Admin web console (djt-web) — application configuration key/value pairs.
 * List/get backed by sttng_lst_t; PUT save persists a key/value.
 */

const mdl = require('../models/configurationsMdl');
const audit = require(appRoot + '/utils/auditUtil');

exports.list = function(req, res) {
    mdl.listMdl()
        .then(rows => res.status(200).json({ status: 200, rows: rows || [] }))
        .catch(e => { console.error('[configurations] list', e); res.status(500).json({ status: 500, error: 'Failed to load configurations' }); });
};

exports.get = function(req, res) {
    mdl.getByIdMdl({ id: req.params.id })
        .then(rows => res.status(200).json({ status: 200, row: (rows && rows[0]) || null }))
        .catch(e => { console.error('[configurations] get', e); res.status(500).json({ status: 500, error: 'Failed to load configurations' }); });
};

exports.create = function(req, res) {
    const body = req.body || {};
    mdl.saveByKeyMdl({ key: body.key, value: body.value })
        .then(result => {
            const ctx = audit.reqCtx(req);
            audit.writeAudit({ userId: ctx.userId, action: 'configuration_create', entityType: 'configuration', entityId: result && result.insertId, newVal: { key: body.key, value: body.value }, ip: ctx.ip, userAgent: ctx.userAgent });
            res.status(200).json({ status: 200, message: 'Configuration created' });
        })
        .catch(e => { console.error('[configurations] create', e); res.status(500).json({ status: 500, error: 'Failed to create configuration' }); });
};

exports.update = function(req, res) {
    const body = req.body || {};
    mdl.updateByIdMdl({ id: req.params.id, value: body.value })
        .then(() => {
            const ctx = audit.reqCtx(req);
            audit.writeAudit({ userId: ctx.userId, action: 'configuration_update', entityType: 'configuration', entityId: req.params.id, newVal: { value: body.value }, ip: ctx.ip, userAgent: ctx.userAgent });
            res.status(200).json({ status: 200, message: 'Configuration updated' });
        })
        .catch(e => { console.error('[configurations] update', e); res.status(500).json({ status: 500, error: 'Failed to update configuration' }); });
};

exports.delete = function(req, res) {
    res.status(200).json({ status: 200, message: 'Configurations cannot be deleted' });
};

// PUT /web/configurations — bulk/blob save of configuration key/values.
exports.save = function(req, res) {
    const body = req.body || {};
    // Accept either { key, value } or a flat key/value object blob.
    const entries = (body.key != null)
        ? [{ key: body.key, value: body.value }]
        : Object.keys(body).map(k => ({ key: k, value: body[k] }));
    Promise.all(entries.map(e => mdl.saveByKeyMdl(e)))
        .then(() => {
            const ctx = audit.reqCtx(req);
            audit.writeAudit({ userId: ctx.userId, action: 'configuration_update', entityType: 'configuration', newVal: { keys: entries.map(e => e.key) }, ip: ctx.ip, userAgent: ctx.userAgent });
            res.status(200).json({ status: 200, message: 'Configuration saved' });
        })
        .catch(e => { console.error('[configurations] save', e); res.status(500).json({ status: 500, error: 'Failed to save configuration' }); });
};
