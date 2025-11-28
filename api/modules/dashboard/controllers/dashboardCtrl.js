/**
 * Dashboard & Analytics Controller
 * Handles dashboard statistics and analytics
 */

const std = require(appRoot + '/utils/standardMessages');
const df = require(appRoot + '/utils/dateFormatUtil');
const dashboardMdl = require('../models/dashboardMdl');
const cntxtDtls = "dashboardCtrl";


/*****************************************************************************
* Function      : getHomeData
* Description   : Get home page data (wallet, nearby stations, recent history)
* Arguments     : req, res
******************************************************************************/
exports.getHomeData = function(req, res) {
    var fnm = "getHomeData";
    const userId = req.user.userId;
    
    // Get all data for home page - only query data, no dummy data
    Promise.all([
        dashboardMdl.getWalletBalanceMdl({ userId: userId }),
        dashboardMdl.getNearbyStationsMdl({ userId: userId, limit: 3 }),
        dashboardMdl.getRecentSessionsMdl({ userId: userId, limit: 3 }),
        dashboardMdl.getUserStatsMdl({ userId: userId })
    ])
    .then(function([walletResult, stations, sessions, statsResult]) {
        // Format wallet data - only from query
        let wallet = null;
        if (walletResult && walletResult.length > 0) {
            wallet = {
                balance: parseFloat(walletResult[0].blnce_amt) || 0,
                last_updated: walletResult[0].lst_updtd_ts ? new Date(walletResult[0].lst_updtd_ts).toISOString() : null
            };
        }
        
        // Format stations - only from query
        let nearbyStations = [];
        if (stations && stations.length > 0) {
            nearbyStations = stations.map(function(s) {
                return {
                    station_id: s.sttn_id,
                    name: s.sttn_nm_tx,
                    address: s.addr_tx,
                    distance: (parseFloat(s.distance) || 0).toFixed(1) + ' km',
                    available_chargers: s.avlbl_chrgrs_nbr || 0,
                    total_chargers: s.ttl_chrgrs_nbr || 0,
                    price_per_kwh: parseFloat(s.prce_per_kwh_amt) || 0,
                    rating: parseFloat(s.rtng_nbr) || 0,
                    is_fast_charging: s.is_fst_chrgng_in === 1,
                    power: s.pwr_tx || null
                };
            });
        }
        
        // Format sessions - only from query
        let recentSessions = [];
        if (sessions && sessions.length > 0) {
            recentSessions = sessions.map(function(s) {
                return {
                    session_id: s.sssn_id,
                    station_name: s.sttn_nm_tx,
                    date: s.i_ts ? new Date(s.i_ts).toISOString().split('T')[0] : null,
                    energy_consumed: parseFloat(s.enrgy_cnsmd_kwh) || 0,
                    cost: parseFloat(s.ttl_cst_amt) || 0,
                    duration_minutes: s.durn_mnts_nbr || 0,
                    status: s.sttus_cd || null
                };
            });
        }
        
        // Format stats - only from query
        let stats = {
            total_sessions: 0,
            total_energy_kwh: 0,
            total_spent: 0,
            co2_saved_kg: 0
        };
        if (statsResult && statsResult.length > 0) {
            const s = statsResult[0];
            stats = {
                total_sessions: s.ttl_sssns_nbr || 0,
                total_energy_kwh: parseFloat(s.ttl_enrgy_kwh) || 0,
                total_spent: parseFloat(s.ttl_spnt_amt) || 0,
                co2_saved_kg: parseFloat(s.co2_svd_kg) || 0
            };
        }
        
        return df.formatSucessRes(req, res, {
            wallet: wallet,
            nearby_stations: nearbyStations,
            recent_sessions: recentSessions,
            stats: stats
        }, cntxtDtls, fnm, {});
    })
    .catch(function(error) {
        console.error('[getHomeData] Error:', error);
        // Return empty data on error - no dummy data
        return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
    });
};

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
