const express = require('express');
const router = express.Router();
const ctrl = require('../../modules/web/settlements/controllers/settlementsCtrl');

router.get('/', ctrl.list);
router.get('/:id', ctrl.get);
router.post('/:id/settle', ctrl.settle);

module.exports = router;
