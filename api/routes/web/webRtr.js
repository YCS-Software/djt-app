/**
 * Web Router (admin web console — djt-web)
 *
 * Aggregates the global/admin-scoped endpoints consumed by the React admin
 * console. Mounted at `/api/web`, so the dashboard endpoints resolve at:
 *   GET /api/web/dashboard/overview
 *   GET /api/web/dashboard/session-trends
 *   GET /api/web/dashboard/station-status
 *   GET /api/web/dashboard/top-stations
 *   GET /api/web/dashboard/live-sessions
 *   GET /api/web/dashboard/recent-activity
 *
 * These are kept separate from the per-user mobile dashboard at /api/dashboard.
 * Every route requires a valid admin JWT (verifyToken + isAdmin).
 */

const express = require('express');
const router = express.Router();
const webDashboardCtrl = require('../../modules/web/controllers/webDashboardCtrl');
const webAnalyticsCtrl = require('../../modules/web/controllers/webAnalyticsCtrl');
const accessCtrl = require('../../modules/auth/validators/accessCtrl');

// Admin-only: all web-console endpoints require an authenticated admin.
router.use(accessCtrl.verifyToken);
router.use(accessCtrl.isAdmin);

// ── Analytics dashboard (DJT HAIKA layout — 9 KPIs + 8 charts) ──────────────
router.get('/dashboard/analytics', webAnalyticsCtrl.getAnalytics);

// ── Dashboard (granular endpoints) ──────────────────────────────────────────
router.get('/dashboard/overview', webDashboardCtrl.getOverview);
router.get('/dashboard/session-trends', webDashboardCtrl.getSessionTrends);
router.get('/dashboard/station-status', webDashboardCtrl.getStationStatus);
router.get('/dashboard/top-stations', webDashboardCtrl.getTopStations);
router.get('/dashboard/live-sessions', webDashboardCtrl.getLiveSessions);
router.get('/dashboard/recent-activity', webDashboardCtrl.getRecentActivity);

// ── Entity resource routers (admin console screens) ─────────────────────────
// Each exposes GET / (list) and GET /:id (detail); admin auth is inherited.
router.use('/partners', require('./partnersRtr'));
router.use('/locations', require('./locationsRtr'));
router.use('/users', require('./usersRtr'));
router.use('/drivers', require('./driversRtr'));
router.use('/transactions', require('./transactionsRtr'));
router.use('/schedules', require('./schedulesRtr'));
router.use('/reservations', require('./reservationsRtr'));
router.use('/cards', require('./cardsRtr'));
router.use('/reviews', require('./reviewsRtr'));
router.use('/coupons', require('./couponsRtr'));
router.use('/reports', require('./reportsRtr'));
router.use('/disputes', require('./disputesRtr'));
router.use('/stations', require('./stationsRtr'));

module.exports = router;
