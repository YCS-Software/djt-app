/**
 * Profile Routes
 */

const express = require('express');
const router = express.Router();
const profileCtrl = require('../../modules/profile/controllers/profileCtrl');
const accessCtrl = require('../../modules/auth/validators/accessCtrl');

// All routes require authentication
router.use(accessCtrl.verifyToken);

// GET /api/profile - Get user profile with statistics
router.get('/', profileCtrl.getProfile);

module.exports = router;

