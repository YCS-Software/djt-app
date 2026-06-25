const express = require('express');
const router = express.Router();
const ctrl = require('../../modules/web/serverLogs/controllers/serverLogsCtrl');
router.get('/', ctrl.list);
module.exports = router;
