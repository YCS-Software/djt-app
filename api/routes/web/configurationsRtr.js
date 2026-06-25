const express = require('express');
const router = express.Router();
const ctrl = require('../../modules/web/configurations/controllers/configurationsCtrl');

router.get('/', ctrl.list);
// PUT /web/configurations — blob save (must precede '/:id').
router.put('/', ctrl.save);
router.get('/:id', ctrl.get);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.delete('/:id', ctrl.delete);

module.exports = router;
