/**
 * Web auditLogs Controller (admin web console — djt-web).
 */
const mdl = require('../models/auditLogsMdl');

exports.list = function (req, res) {
    const q = req.query || {};
    mdl.listMdl({
        userId: q.user_id,
        action: q.action,
        category: q.category,
        entityType: q.entity_type,
        entityId: q.entity_id,
        limit: q.limit,
        offset: q.offset,
    })
        .then(rows => res.status(200).json({ status: 200, rows: rows || [] }))
        .catch(e => { console.error('[auditLogs] list', e); res.status(500).json({ status: 500, error: 'Failed to load logs' }); });
};

// Action master (for filter dropdowns: code, label, category)
exports.actions = function (req, res) {
    mdl.listActionsMdl()
        .then(rows => res.status(200).json({ status: 200, rows: rows || [] }))
        .catch(e => { console.error('[auditLogs] actions', e); res.status(500).json({ status: 500, error: 'Failed to load actions' }); });
};
