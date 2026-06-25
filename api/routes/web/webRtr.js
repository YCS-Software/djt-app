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
// Bulk remote commands resolve at POST /web/stations/bulk-remote
router.use('/stations', require('./bulkRemoteRtr'));

// ── MANAGE group ────────────────────────────────────────────────────────────
router.use('/businesses', require('./businessesRtr'));
router.use('/settlements', require('./settlementsRtr'));

// ── LIVE ANALYTICS ──────────────────────────────────────────────────────────
router.use('/live-sessions', require('./live-sessionsRtr'));

// ── Role-based navigation menu (login-based sidebar) ────────────────────────
router.use('/menu', require('./menuRtr'));

// ── NETWORK group (no backing *_lst_t table yet — list returns [], writes no-op) ──
router.use('/subscriptions', require('./subscriptionsRtr'));
router.use('/member-groups', require('./member-groupsRtr'));
router.use('/courtesy-sessions', require('./courtesy-sessionsRtr'));
router.use('/agents', require('./agentsRtr'));

// ── ROAMING + CHARGE extras ─────────────────────────────────────────────────
router.use('/cdr', require('./cdrRtr'));
router.use('/emsp-tokens', require('./emsp-tokensRtr'));
router.use('/downtime', require('./downtimeRtr'));
router.use('/smart-scheduling', require('./smart-schedulingRtr'));
router.use('/connections', require('./connectionsRtr'));
router.use('/server-logs', require('./serverLogsRtr'));
router.use('/audit-logs', require('./auditLogsRtr'));

// ── TOOLS & UTILITIES + ADMIN TOOLS group (new) ─────────────────────────────
// static-data, configurations, roles, settings are backed by real *_lst_t
// tables; instructions and products have no backing table yet (list -> []).
router.use('/static-data', require('./staticDataRtr'));
router.use('/configurations', require('./configurationsRtr'));
router.use('/instructions', require('./instructionsRtr'));
router.use('/roles', require('./rolesRtr'));
router.use('/products', require('./productsRtr'));
router.use('/settings', require('./settingsRtr'));

module.exports = router;
