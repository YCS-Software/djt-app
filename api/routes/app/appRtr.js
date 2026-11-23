/**
 * App Routes (public — the app calls these before the user is logged in)
 */

const express = require('express');
const router = express.Router();
const appCtrl = require('../../modules/app/controllers/appCtrl');

// GET /api/app/version - minimum / latest supported app version
router.get('/version', appCtrl.getVersion);

module.exports = router;
