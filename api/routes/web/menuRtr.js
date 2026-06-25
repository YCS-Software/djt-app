const express = require('express');
const router = express.Router();
const ctrl = require('../../modules/web/menu/controllers/menuCtrl');

router.get('/', ctrl.getMenu);

module.exports = router;
