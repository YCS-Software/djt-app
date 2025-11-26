/**
 * Dashboard & Analytics Controller
 * Handles dashboard statistics and analytics
 */

const std = require(appRoot + '/utils/standardMessages');
const df = require(appRoot + '/utils/dateFormatUtil');
const dashboardMdl = require('../models/dashboardMdl');
const cntxtDtls = "dashboardCtrl";

/*****************************************************************************
* Function      : getStats
* Description   : Get dashboard stats
* Arguments     : req, res
******************************************************************************/
exports.getStats = function(req, res) {
    let data = req.body.data ? req.body.data : req.body;
    var fnm = "getStats";
    
    const userId = req.user.userId;
    
    dashboardMdl.getDashboardStatsMdl({ userId: userId })
        .then(function(results) {
            if (!results || results.length === 0) {
                return df.formatSucessRes(req, res, {
                    stats: {
                        total_sessions: 0,
                        total_energy_kwh: 0,
                        total_spent: 0,
                        co2_saved_kg: 0,
                        avg_session_duration: 0,
                        avg_session_cost: 0
                    }
                }, cntxtDtls, fnm, {});
            }
            
            const stats = results[0];
            return df.formatSucessRes(req, res, {
                stats: {
                    total_sessions: stats.total_sessions || 0,
                    total_energy_kwh: parseFloat(stats.total_energy) || 0,
                    total_spent: parseFloat(stats.total_spent) || 0,
                    co2_saved_kg: parseFloat(stats.co2_saved) || 0,
                    avg_session_duration: parseInt(stats.avg_duration) || 0,
                    avg_session_cost: parseFloat(stats.avg_cost) || 0
                }
            }, cntxtDtls, fnm, {});
        })
        .catch(function(error) {
            console.error('[getStats] Error:', error);
            return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
        });
};

/*****************************************************************************
* Function      : getMonthlyAnalytics
* Description   : Get monthly analytics
* Arguments     : req, res
******************************************************************************/
exports.getMonthlyAnalytics = function(req, res) {
    let data = req.body.data ? req.body.data : req.body;
    var fnm = "getMonthlyAnalytics";
    
    const userId = req.user.userId;
    const months = parseInt(req.params.months) || 6;
    
    dashboardMdl.getMonthlyAnalyticsMdl({ userId: userId, months: months })
        .then(function(monthlyData) {
            const formattedData = monthlyData.map(function(m) {
                return {
                    month: m.month,
                    sessions: m.sessions || 0,
                    energy: parseFloat(m.energy) || 0,
                    cost: parseFloat(m.cost) || 0
                };
            });
            
            return df.formatSucessRes(req, res, {
                monthly_data: formattedData
            }, cntxtDtls, fnm, {});
        })
        .catch(function(error) {
            console.error('[getMonthlyAnalytics] Error:', error);
            return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
        });
};

/*****************************************************************************
* Function      : getWeeklyActivity
* Description   : Get weekly activity
* Arguments     : req, res
******************************************************************************/
exports.getWeeklyActivity = function(req, res) {
    let data = req.body.data ? req.body.data : req.body;
    var fnm = "getWeeklyActivity";
    
    const userId = req.user.userId;
    
    dashboardMdl.getWeeklyActivityMdl({ userId: userId })
        .then(function(weeklyData) {
            const formattedData = weeklyData.map(function(w) {
                return {
                    day: w.day,
                    sessions: w.sessions || 0
                };
            });
            
            return df.formatSucessRes(req, res, {
                weekly_activity: formattedData
            }, cntxtDtls, fnm, {});
        })
        .catch(function(error) {
            console.error('[getWeeklyActivity] Error:', error);
            return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
        });
};

/*****************************************************************************
* Function      : getFavoriteStations
* Description   : Get favorite stations analytics
* Arguments     : req, res
******************************************************************************/
exports.getFavoriteStations = function(req, res) {
    let data = req.body.data ? req.body.data : req.body;
    var fnm = "getFavoriteStations";
    
    const userId = req.user.userId;
    
    dashboardMdl.getFavoriteStationsAnalyticsMdl({ userId: userId })
        .then(function(favoriteStations) {
            const formattedData = favoriteStations.map(function(f) {
                return {
                    name: f.name,
                    sessions: f.sessions || 0,
                    percentage: parseInt(f.percentage) || 0
                };
            });
            
            return df.formatSucessRes(req, res, {
                favorite_stations: formattedData
            }, cntxtDtls, fnm, {});
        })
        .catch(function(error) {
            console.error('[getFavoriteStations] Error:', error);
            return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
        });
};
