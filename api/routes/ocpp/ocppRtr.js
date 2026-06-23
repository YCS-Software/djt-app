/**
 * OCPP Control Routes (REST)
 * Owner-only monitoring + remote control of connected charge points.
 * NOTE: the OCPP WebSocket itself is served at /ocpp/<chargePointId> (see ocppServer.js),
 * separate from these /api/ocpp REST endpoints.
 */

const express = require('express');
const router = express.Router();
const ocppCtrl = require('../../modules/ocpp/controllers/ocppCtrl');
const accessCtrl = require('../../modules/auth/validators/accessCtrl');

router.use(accessCtrl.verifyToken);
router.use(accessCtrl.isOwner);

router.get('/connections', ocppCtrl.getConnections);
router.post('/remote-start', ocppCtrl.remoteStart);
router.post('/remote-stop', ocppCtrl.remoteStop);

module.exports = router;
