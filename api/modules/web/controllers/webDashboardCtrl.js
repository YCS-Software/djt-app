/**
 * Web Dashboard Controller
 * Admin web console (djt-web) dashboard endpoints. Responses are shaped to
 * match the frontend redux thunks in
 * `frontend/src/features/dashboard/dashboardSlice.ts`:
 *   overview        -> { overview }
 *   session-trends  -> { trends }
 *   top-stations    -> { stations }
 *   live-sessions   -> { sessions }
 *   recent-activity -> { activity }
 *   station-status  -> { stationStatus }
 */

const std = require(appRoot + '/utils/standardMessages');
const webDashboardMdl = require('../models/webDashboardMdl');
const cntxtDtls = "webDashboardCtrl";

// Consistent error response — the frontend reads error.response.data.error.
const fail = (res, fnm, error) => {
    console.error(`[${cntxtDtls}] ${fnm} - Error:`, error);
    return res.status(std.message["INTERNAL_ERROR"].code).json({
        status: std.message["INTERNAL_ERROR"].code,
        error: 'Failed to load dashboard data',
        data: null
    });
};

const num = (v) => parseFloat(v) || 0;

/*****************************************************************************
* Function      : getOverview
* Description   : Network KPI cards.
******************************************************************************/
exports.getOverview = function(req, res) {
    const fnm = "getOverview";

    webDashboardMdl.getOverviewMdl()
        .then(function(results) {
            const r = (results && results[0]) || {};
            const total = parseInt(r.total_stations, 10) || 0;
            const online = parseInt(r.online_stations, 10) || 0;

            const overview = {
                stations: {
                    total: total,
                    online: online,
                    offline: Math.max(0, total - online)
                },
                connectors: parseInt(r.total_connectors, 10) || 0,
                activeSessions: parseInt(r.active_sessions, 10) || 0,
                totalDrivers: parseInt(r.total_drivers, 10) || 0,
                today: {
                    sessions: parseInt(r.today_sessions, 10) || 0,
                    energy: num(r.today_energy).toFixed(2),
                    revenue: num(r.today_revenue).toFixed(2)
                }
            };

            return res.status(std.message["SUCCESS"].code).json({
                status: std.message["SUCCESS"].code,
                overview: overview
            });
        })
        .catch((error) => fail(res, fnm, error));
};

/*****************************************************************************
* Function      : getSessionTrends
* Description   : Daily sessions / energy / revenue for the trend chart.
******************************************************************************/
exports.getSessionTrends = function(req, res) {
    const fnm = "getSessionTrends";
    const days = req.query.days || (req.query.period === '30d' ? 30 : 7);

    webDashboardMdl.getSessionTrendsMdl({ days: days })
        .then(function(rows) {
            const trends = (rows || []).map(function(t) {
                return {
                    period: t.period,
                    sessions: parseInt(t.sessions, 10) || 0,
                    energy: num(t.energy),
                    revenue: num(t.revenue)
                };
            });

            return res.status(std.message["SUCCESS"].code).json({
                status: std.message["SUCCESS"].code,
                trends: trends
            });
        })
        .catch((error) => fail(res, fnm, error));
};

/*****************************************************************************
* Function      : getStationStatus
* Description   : Online/offline machine counts + total connectors.
******************************************************************************/
exports.getStationStatus = function(req, res) {
    const fnm = "getStationStatus";

    webDashboardMdl.getStationStatusMdl()
        .then(function(results) {
            const r = (results && results[0]) || {};
            return res.status(std.message["SUCCESS"].code).json({
                status: std.message["SUCCESS"].code,
                stationStatus: {
                    online: parseInt(r.online, 10) || 0,
                    offline: parseInt(r.offline, 10) || 0,
                    totalConnectors: parseInt(r.total_connectors, 10) || 0
                }
            });
        })
        .catch((error) => fail(res, fnm, error));
};

/*****************************************************************************
* Function      : getTopStations
* Description   : Stations ranked by revenue.
******************************************************************************/
exports.getTopStations = function(req, res) {
    const fnm = "getTopStations";
    const limit = req.query.limit || 5;

    webDashboardMdl.getTopStationsMdl({ limit: limit })
        .then(function(rows) {
            const stations = (rows || []).map(function(s) {
                return {
                    stationId: s.stationId,
                    station: { name: s.name },
                    sessionCount: parseInt(s.sessionCount, 10) || 0,
                    totalRevenue: num(s.totalRevenue)
                };
            });

            return res.status(std.message["SUCCESS"].code).json({
                status: std.message["SUCCESS"].code,
                stations: stations
            });
        })
        .catch((error) => fail(res, fnm, error));
};

/*****************************************************************************
* Function      : getLiveSessions
* Description   : Active charging sessions.
******************************************************************************/
exports.getLiveSessions = function(req, res) {
    const fnm = "getLiveSessions";

    webDashboardMdl.getLiveSessionsMdl()
        .then(function(rows) {
            const sessions = (rows || []).map(function(s) {
                return {
                    id: s.id,
                    station: { name: s.station_name },
                    driver: { name: s.driver_name },
                    energyDelivered: num(s.energy),
                    progress: num(s.progress),
                    status: s.status,
                    startedAt: s.started_at
                };
            });

            return res.status(std.message["SUCCESS"].code).json({
                status: std.message["SUCCESS"].code,
                sessions: sessions
            });
        })
        .catch((error) => fail(res, fnm, error));
};

/*****************************************************************************
* Function      : getRecentActivity
* Description   : Recent network-wide charging activity feed.
******************************************************************************/
exports.getRecentActivity = function(req, res) {
    const fnm = "getRecentActivity";
    const limit = req.query.limit || 10;

    webDashboardMdl.getRecentActivityMdl({ limit: limit })
        .then(function(rows) {
            const activity = (rows || []).map(function(a) {
                return {
                    id: a.id,
                    type: 'session',
                    station: { name: a.station_name },
                    user: { name: a.user_name },
                    amount: num(a.amount),
                    status: a.status,
                    timestamp: a.timestamp
                };
            });

            return res.status(std.message["SUCCESS"].code).json({
                status: std.message["SUCCESS"].code,
                activity: activity
            });
        })
        .catch((error) => fail(res, fnm, error));
};
