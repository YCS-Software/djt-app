/**
 * Owner Routes (EV Station Owner)
 * All routes require an authenticated user with the 'owner' (or 'admin') role.
 */

const express = require('express');
const router = express.Router();
const ownerCtrl = require('../../modules/owner/controllers/ownerCtrl');
const accessCtrl = require('../../modules/auth/validators/accessCtrl');

// Every owner route is authenticated + role-checked
router.use(accessCtrl.verifyToken);
router.use(accessCtrl.isOwner);

// Dashboard summary
router.get('/dashboard', ownerCtrl.getDashboard);

// Stations
router.get('/stations', ownerCtrl.getMyStations);
router.post('/stations', ownerCtrl.createStation);
router.get('/stations/:stationId', ownerCtrl.getStationDetail);
router.put('/stations/:stationId', ownerCtrl.updateStation);

// Machines (chargers) under a station
router.get('/stations/:stationId/machines', ownerCtrl.getStationMachines);
router.post('/stations/:stationId/machines', ownerCtrl.addMachine);
router.put('/machines/:machineId', ownerCtrl.updateMachine);

// Connectors under a machine
router.post('/machines/:machineId/connectors', ownerCtrl.addConnector);

module.exports = router;
