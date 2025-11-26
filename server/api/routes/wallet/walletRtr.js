/**
 * Wallet Routes
 */

const express = require('express');
const router = express.Router();
const walletCtrl = require('../../modules/wallet/controllers/walletCtrl');
const accessCtrl = require('../../modules/auth/validators/accessCtrl');

// All routes require authentication
router.use(accessCtrl.verifyToken);

// GET /api/wallet/balance - Get wallet balance
router.get('/balance', walletCtrl.getBalance);

// POST /api/wallet/add-money - Add money to wallet
router.post('/add-money', walletCtrl.addMoney);

// GET /api/wallet/transactions - Get transaction history
router.get('/transactions', walletCtrl.getTransactions);

// POST /api/wallet/transfer - Transfer money
router.post('/transfer', walletCtrl.transferMoney);

module.exports = router;
