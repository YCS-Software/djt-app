const express = require('express');
const router = express.Router();
const ctrl = require('../../modules/web/liveSessions/controllers/liveSessionsCtrl');

router.get('/', ctrl.list);
router.post('/:id/stop', ctrl.stop);

module.exports = router;
