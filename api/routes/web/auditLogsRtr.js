const express = require('express');
const router = express.Router();
const ctrl = require('../../modules/web/auditLogs/controllers/auditLogsCtrl');
router.get('/', ctrl.list);
router.get('/actions', ctrl.actions);
module.exports = router;
