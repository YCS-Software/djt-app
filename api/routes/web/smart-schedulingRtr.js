const express = require('express');
const router = express.Router();
const ctrl = require('../../modules/web/smartScheduling/controllers/smartSchedulingCtrl');

router.get('/', ctrl.list);
router.get('/:id', ctrl.get);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.delete('/:id', ctrl.delete);

module.exports = router;
