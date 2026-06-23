var express = require('express');
var router = express.Router();
var authAppCtrl = require('../../modules/auth/controllers/authAppCtrl');
var registerCtrl = require('../../modules/auth/controllers/registerCtrl');
var checkUser = require('../../modules/auth/validators/accessCtrl');

/**
 * Authentication Routes
 */

// ── Admin web console (email + password, no OTP) ──────────────────────────
// Consumed by djt-web (frontend/src/services/api.ts -> authApi).
router.post('/login', authAppCtrl.login);
router.post('/refresh', authAppCtrl.refresh);
router.post('/logout', authAppCtrl.logout);
router.get('/me', checkUser.verifyToken, authAppCtrl.getMe);

// Send OTP to mobile number (login)
router.post('/app/otp', authAppCtrl.sendOTP);

// Send OTP for signup (allows non-registered users)
router.post('/app/signup/otp', authAppCtrl.sendSignupOTP);

// Verify OTP
router.post('/app/verify/otp', authAppCtrl.verifyOTP);

// Resend OTP
router.post('/app/resend/otp', authAppCtrl.resendOTP);

// Get user info (protected route)
router.get('/user/info', checkUser.verifyToken, authAppCtrl.getUserInfo);

// Register new user
router.post('/register', registerCtrl.register);

// Update user profile (protected route)
router.put('/profile', checkUser.verifyToken, registerCtrl.updateProfile);

module.exports = router;
