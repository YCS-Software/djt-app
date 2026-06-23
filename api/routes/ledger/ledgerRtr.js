/**
 * Ledger Routes
 *   PUBLIC : POST /api/ledger/webhook/razorpay   (signature-verified, no JWT)
 *   AUTH'D : GET  /api/ledger/accounts
 *            GET  /api/ledger/accounts/:acctId/statement
 *            GET  /api/ledger/journals/:jrnlId
 */

const express = require('express');
const router = express.Router();
const ledgerCtrl = require('../../modules/ledger/controllers/ledgerCtrl');
const accessCtrl = require('../../modules/auth/validators/accessCtrl');

// Public webhook (must NOT require a JWT — Razorpay calls it server-to-server).
router.post('/webhook/razorpay', ledgerCtrl.razorpayWebhook);

// Everything below requires authentication.
router.use(accessCtrl.verifyToken);

router.get('/accounts', ledgerCtrl.getMyAccounts);
router.get('/accounts/:acctId/statement', ledgerCtrl.getAccountStatement);
router.get('/journals/:jrnlId', ledgerCtrl.getJournal);

module.exports = router;
