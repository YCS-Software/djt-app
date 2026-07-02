/**
 * eMSP Tokens Controller (admin web console — djt-web)
 * Full CRUD over `tkn_lst_t`.
 */

const mdl = require('../models/emspTokensMdl');
const audit = require(appRoot + '/utils/auditUtil');

exports.list = function (req, res) {
    mdl.listMdl()
        .then(rows => res.status(200).json({ status: 200, rows: rows || [] }))
        .catch(e => { console.error('[emspTokens] list', e); res.status(500).json({ status: 500, error: 'Failed to load eMSP tokens' }); });
};

exports.get = function (req, res) {
    mdl.getByIdMdl({ id: req.params.id })
        .then(rows => res.status(200).json({ status: 200, row: (rows && rows[0]) || null }))
        .catch(e => { console.error('[emspTokens] get', e); res.status(500).json({ status: 500, error: 'Failed to load eMSP token' }); });
};

exports.create = function (req, res) {
    const body = req.body || {};
    mdl.createMdl(body)
        .then(result => {
            const ctx = audit.reqCtx(req);
            audit.writeAudit({ userId: ctx.userId, action: 'emsp_token_create', entityType: 'emsp_token', entityId: result && result.insertId, newVal: { type: body.type }, ip: ctx.ip, userAgent: ctx.userAgent });
            res.status(200).json({ status: 200, message: 'eMSP token created' });
        })
        .catch(e => { console.error('[emspTokens] create', e); res.status(500).json({ status: 500, error: 'Failed to create eMSP token' }); });
};

exports.update = function (req, res) {
    const body = req.body || {};
    mdl.updateMdl({ id: req.params.id, ...body })
        .then(() => {
            const ctx = audit.reqCtx(req);
            audit.writeAudit({ userId: ctx.userId, action: 'emsp_token_update', entityType: 'emsp_token', entityId: req.params.id, newVal: { type: body.type }, ip: ctx.ip, userAgent: ctx.userAgent });
            res.status(200).json({ status: 200, message: 'eMSP token updated' });
        })
        .catch(e => { console.error('[emspTokens] update', e); res.status(500).json({ status: 500, error: 'Failed to update eMSP token' }); });
};

exports.delete = function (req, res) {
    mdl.deleteMdl({ id: req.params.id })
        .then(() => {
            const ctx = audit.reqCtx(req);
            audit.writeAudit({ userId: ctx.userId, action: 'emsp_token_delete', entityType: 'emsp_token', entityId: req.params.id, ip: ctx.ip, userAgent: ctx.userAgent });
            res.status(200).json({ status: 200, message: 'eMSP token deleted' });
        })
        .catch(e => { console.error('[emspTokens] delete', e); res.status(500).json({ status: 500, error: 'Failed to delete eMSP token' }); });
};
