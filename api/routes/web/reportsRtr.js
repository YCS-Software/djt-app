const express = require('express');
const router = express.Router();
const ctrl = require('../../modules/web/reports/controllers/reportsCtrl');

router.get('/meta', ctrl.meta);
router.get('/generate', ctrl.generate);
router.get('/', ctrl.list);
router.get('/:id', ctrl.get);

module.exports = router;
