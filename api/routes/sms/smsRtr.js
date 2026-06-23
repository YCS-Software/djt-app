var express = require('express');
var router = express.Router();
var smsCtrl = require('../../modules/sms/controllers/smsCtrl');

/**
 * SMS Routes
 */

// Send a templated SMS  { template, mobile, variables: { var1: '1234' } }
router.post('/send', smsCtrl.sendMessage);

// Templates
router.post('/templates', smsCtrl.addTemplate);
router.get('/templates', smsCtrl.listTemplates);

// Gateway config (sender id, country code, default OTP template) — stored in DB
router.get('/config', smsCtrl.getConfig);
router.post('/config', smsCtrl.updateConfig);

// Audit log  ?mobile=...&limit=...
router.get('/logs', smsCtrl.getLogs);

module.exports = router;
