/**
 * Charging Session Routes
 */

const express = require('express');
const router = express.Router();
const sessionCtrl = require('../../modules/sessions/controllers/sessionCtrl');
const accessCtrl = require('../../modules/auth/validators/accessCtrl');

// All routes require authentication
router.use(accessCtrl.verifyToken);

// POST /api/sessions/start - Start charging session
router.post('/start', sessionCtrl.startSession);

// POST /api/sessions/stop - Stop charging session
router.post('/stop', sessionCtrl.stopSession);

// GET /api/sessions/active - Get active session
router.get('/active', sessionCtrl.getActiveSession);

// GET /api/sessions/history - Get session history
router.get('/history', sessionCtrl.getSessionHistory);

// GET /api/sessions/:sessionId - Get session details
router.get('/:sessionId', sessionCtrl.getSessionDetails);

module.exports = router;
