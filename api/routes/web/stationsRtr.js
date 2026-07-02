const express = require('express');
const router = express.Router();
const ctrl = require('../../modules/web/stations/controllers/stationsCtrl');

router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.get('/:id', ctrl.get);

module.exports = router;
