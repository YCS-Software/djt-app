/**
 * Dashboard Routes
 */

const express = require('express');
const router = express.Router();
const dashboardCtrl = require('../../modules/dashboard/controllers/dashboardCtrl');
const accessCtrl = require('../../modules/auth/validators/accessCtrl');

// All routes require authentication
router.use(accessCtrl.verifyToken);

// GET /api/dashboard/home - Get home page data (wallet, stations, history)
router.get('/home', dashboardCtrl.getHomeData);

// GET /api/dashboard/stats - Get dashboard statistics
router.get('/stats', dashboardCtrl.getStats);

// GET /api/dashboard/analytics/monthly?months=6 - Get monthly analytics
router.get('/analytics/monthly/:months', dashboardCtrl.getMonthlyAnalytics);

// GET /api/dashboard/analytics/weekly - Get weekly activity
router.get('/analytics/weekly', dashboardCtrl.getWeeklyActivity);

// GET /api/dashboard/analytics/favorite-stations - Get favorite stations analytics
router.get('/analytics/favorite-stations', dashboardCtrl.getFavoriteStations);

module.exports = router;
