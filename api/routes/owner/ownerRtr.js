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

// Rich dashboard analytics (revenue/consumption charts, station status, recent txns)
router.get('/analytics', ownerCtrl.getAnalytics);

// Full transaction list across the owner's stations
router.get('/transactions', ownerCtrl.getTransactions);

// Machine power options (master list for the dropdown)
router.get('/power-options', ownerCtrl.getPowerOptions);

// Stations
router.get('/stations', ownerCtrl.getMyStations);
router.post('/stations', ownerCtrl.createStation);
router.get('/stations/:stationId', ownerCtrl.getStationDetail);
router.get('/stations/:stationId/analytics', ownerCtrl.getStationAnalytics);
router.put('/stations/:stationId', ownerCtrl.updateStation);

// Machines (chargers) under a station
router.get('/stations/:stationId/machines', ownerCtrl.getStationMachines);
router.post('/stations/:stationId/machines', ownerCtrl.addMachine);
router.get('/machines/:machineId', ownerCtrl.getMachineProfile);
router.get('/machines/:machineId/qr', ownerCtrl.getMachineQr);

// Per-connector QR (each plug has its own QR)
router.get('/connectors/:connectorId/qr', ownerCtrl.getConnectorQr);
router.put('/machines/:machineId', ownerCtrl.updateMachine);

// Connectors under a machine
router.post('/machines/:machineId/connectors', ownerCtrl.addConnector);

module.exports = router;
