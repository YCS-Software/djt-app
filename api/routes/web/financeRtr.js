const express = require('express');
const router = express.Router();
const ctrl = require('../../modules/web/finance/controllers/financeCtrl');

// Franchises (station owners) and their revenue share vs the DJT platform.
router.get('/franchises', ctrl.getFranchises);

module.exports = router;
