const express = require('express');
const router = express.Router();
const ctrl = require('../../modules/web/sessions/controllers/sessionsCtrl');

router.get('/', ctrl.list);
router.get('/summary', ctrl.summary);
router.get('/:id/logs', ctrl.logs);
router.get('/:id', ctrl.get);

module.exports = router;
