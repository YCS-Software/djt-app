const express = require('express');
const router = express.Router();
const ctrl = require('../../modules/web/settings/controllers/settingsCtrl');

// Scope-keyed settings (backed by sttng_lst_t).
router.get('/:scope', ctrl.getByScope);
router.put('/:scope', ctrl.saveByScope);

module.exports = router;
