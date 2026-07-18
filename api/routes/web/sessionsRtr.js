const express = require('express');
const router = express.Router();
const ctrl = require('../../modules/web/sessions/controllers/sessionsCtrl');

router.get('/', ctrl.list);
router.get('/:id', ctrl.get);

module.exports = router;
