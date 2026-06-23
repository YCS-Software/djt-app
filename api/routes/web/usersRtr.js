const express = require('express');
const router = express.Router();
const ctrl = require('../../modules/web/users/controllers/usersCtrl');

router.get('/', ctrl.list);
router.get('/:id', ctrl.get);

module.exports = router;
