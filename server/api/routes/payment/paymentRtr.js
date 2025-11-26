/**
 * Payment Routes
 */

const express = require('express');
const router = express.Router();
const paymentCtrl = require('../../modules/payment/controllers/paymentCtrl');
const accessCtrl = require('../../modules/auth/validators/accessCtrl');

// All routes require authentication
router.use(accessCtrl.verifyToken);

// POST /api/payment/create-order - Create payment order
router.post('/create-order', paymentCtrl.createOrder);

// POST /api/payment/verify - Verify payment
router.post('/verify', paymentCtrl.verifyPayment);

module.exports = router;

