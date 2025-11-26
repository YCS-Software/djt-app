/**
 * Charging Station Routes
 */

const express = require('express');
const router = express.Router();
const stationCtrl = require('../../modules/stations/controllers/stationCtrl');
const accessCtrl = require('../../modules/auth/validators/accessCtrl');

// All routes require authentication
router.use(accessCtrl.verifyToken);

// GET /api/stations/nearby - Get nearby stations
router.get('/nearby', stationCtrl.getNearbyStations);

// GET /api/stations/all - Get all active stations
router.get('/all', stationCtrl.getAllStations);

// GET /api/stations/search - Search stations
router.get('/search', stationCtrl.searchStations);

// GET /api/stations/favorites - Get favorite stations
router.get('/favorites', stationCtrl.getFavorites);

// POST /api/stations/favorites - Add favorite station
router.post('/favorites', stationCtrl.addFavorite);

// DELETE /api/stations/favorites/:stationId - Remove favorite station
router.delete('/favorites/:stationId', stationCtrl.removeFavorite);

// GET /api/stations/:stationId - Get station details
router.get('/:stationId', stationCtrl.getStationDetails);

module.exports = router;
