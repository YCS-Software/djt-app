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
router.get('/logs', ocppCtrl.getLogs);
router.post('/remote-start', ocppCtrl.remoteStart);
router.post('/remote-stop', ocppCtrl.remoteStop);

// Charger Controls (owner remote operations)
router.post('/reset', ocppCtrl.reset);
router.post('/clear-cache', ocppCtrl.clearCache);
router.post('/unlock-connector', ocppCtrl.unlockConnector);
router.post('/change-availability', ocppCtrl.changeAvailability);
router.post('/trigger-message', ocppCtrl.triggerMessage);
router.post('/get-configuration', ocppCtrl.getConfiguration);
router.post('/get-diagnostics', ocppCtrl.getDiagnostics);
router.post('/update-firmware', ocppCtrl.updateFirmware);

module.exports = router;
