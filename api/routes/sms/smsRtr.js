var express = require('express');
var router = express.Router();
var smsCtrl = require('../../modules/sms/controllers/smsCtrl');

var accessCtrl = require('../../modules/auth/validators/accessCtrl');

/**
 * SMS Routes — admin only. These can send SMS at the company's cost and read
 * the message log (which contains OTP codes).
 */
router.use(accessCtrl.verifyToken);
router.use(accessCtrl.isAdmin);

// Send one template by hand  { template: 'DJT_OTP', mobile, data: { otp: '4821' } }
router.post('/send', smsCtrl.sendMessage);

// Final text with real values filled in; sends nothing  (same body as /send)
router.post('/preview', smsCtrl.preview);

// Mistakes in the template / variable rows
router.get('/check', smsCtrl.checkSetup);

// Templates
router.post('/templates', smsCtrl.addTemplate);
router.get('/templates', smsCtrl.listTemplates);

// Audit log  ?mobile=...&limit=...
router.get('/logs', smsCtrl.getLogs);

module.exports = router;
