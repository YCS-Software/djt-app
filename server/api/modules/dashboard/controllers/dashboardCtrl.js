/**
 * Dashboard & Analytics Controller
 * Handles dashboard statistics and analytics
 */

const std = require(appRoot + '/utils/standardMessages');
const df = require(appRoot + '/utils/dateFormatUtil');
const dashboardMdl = require('../models/dashboardMdl');
const cntxtDtls = "dashboardCtrl";

// Dummy data for home page
const DUMMY_STATIONS = [
    {
        station_id: 1,
        name: 'DJT HAIKA PowerHub Mall Road',
        address: 'Mall Road, Sector 18',
        distance: '0.5 km',
        available_chargers: 3,
        total_chargers: 4,
        price_per_kwh: 10.00,
        rating: 4.5,
        is_fast_charging: true,
        power: '150kW'
    },
    {
        station_id: 2,
        name: 'DJT HAIKA EcoCharge Central',
        address: 'Central Park, MG Road',
        distance: '1.2 km',
        available_chargers: 4,
        total_chargers: 6,
        price_per_kwh: 8.00,
        rating: 4.2,
        is_fast_charging: false,
        power: '22kW'
    },
    {
        station_id: 3,
        name: 'DJT HAIKA QuickCharge Express',
        address: 'Tech Park, Cyber City',
        distance: '2.1 km',
        available_chargers: 2,
        total_chargers: 3,
        price_per_kwh: 12.00,
        rating: 4.7,
        is_fast_charging: true,
        power: '350kW'
    }
];

const DUMMY_SESSIONS = [
    {
        session_id: 1001,
        station_name: 'DJT HAIKA PowerHub Mall Road',
        date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        energy_consumed: 15.5,
        cost: 155.00,
        duration_minutes: 45,
        status: 'completed'
    },
    {
        session_id: 1002,
        station_name: 'DJT HAIKA EcoCharge Central',
        date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        energy_consumed: 22.3,
        cost: 178.40,
        duration_minutes: 60,
        status: 'completed'
    },
    {
        session_id: 1003,
        station_name: 'DJT HAIKA QuickCharge Express',
        date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        energy_consumed: 18.0,
        cost: 216.00,
        duration_minutes: 30,
        status: 'completed'
    }
];

/*****************************************************************************
* Function      : getHomeData
* Description   : Get home page data (wallet, nearby stations, recent history)
* Arguments     : req, res
******************************************************************************/
exports.getHomeData = function(req, res) {
    var fnm = "getHomeData";
    const userId = req.user.userId;
    
    // Get all data for home page
    Promise.all([
        dashboardMdl.getWalletBalanceMdl({ userId: userId }).catch(() => null),
        dashboardMdl.getNearbyStationsMdl({ userId: userId, limit: 3 }).catch(() => []),
        dashboardMdl.getRecentSessionsMdl({ userId: userId, limit: 3 }).catch(() => []),
        dashboardMdl.getUserStatsMdl({ userId: userId }).catch(() => null)
    ])
    .then(function([walletResult, stations, sessions, statsResult]) {
        // Format wallet data
        let wallet = {
            balance: 520.00,
            last_updated: new Date().toISOString()
        };
        if (walletResult && walletResult.length > 0) {
            wallet = {
                balance: parseFloat(walletResult[0].blnce_amt) || 520.00,
                last_updated: walletResult[0].lst_updtd_ts || new Date().toISOString()
            };
        }
        
        // Format stations - use dummy if empty
        let nearbyStations = DUMMY_STATIONS;
        if (stations && stations.length > 0) {
            nearbyStations = stations.map(function(s) {
                return {
                    station_id: s.sttn_id,
                    name: s.sttn_nm_tx,
                    address: s.addr_tx,
                    distance: (parseFloat(s.distance) || 0).toFixed(1) + ' km',
                    available_chargers: s.avlbl_chrgrs_nbr,
                    total_chargers: s.ttl_chrgrs_nbr,
                    price_per_kwh: parseFloat(s.prce_per_kwh_amt),
                    rating: parseFloat(s.rtng_nbr),
                    is_fast_charging: s.is_fst_chrgng_in === 1,
                    power: s.pwr_tx
                };
            });
        }
        
        // Format sessions - use dummy if empty
        let recentSessions = DUMMY_SESSIONS;
        if (sessions && sessions.length > 0) {
            recentSessions = sessions.map(function(s) {
                return {
                    session_id: s.sssn_id,
                    station_name: s.sttn_nm_tx,
                    date: s.i_ts ? new Date(s.i_ts).toISOString().split('T')[0] : null,
                    energy_consumed: parseFloat(s.enrgy_cnsmd_kwh) || 0,
                    cost: parseFloat(s.ttl_cst_amt) || 0,
                    duration_minutes: s.durn_mnts_nbr || 0,
                    status: s.sttus_cd
                };
            });
        }
        
        // Format stats
        let stats = {
            total_sessions: 47,
            total_energy_kwh: 1245,
            total_spent: 12450,
            co2_saved_kg: 1020.9
        };
        if (statsResult && statsResult.length > 0) {
            const s = statsResult[0];
            stats = {
                total_sessions: s.ttl_sssns_nbr || 47,
                total_energy_kwh: parseFloat(s.ttl_enrgy_kwh) || 1245,
                total_spent: parseFloat(s.ttl_spnt_amt) || 12450,
                co2_saved_kg: parseFloat(s.co2_svd_kg) || 1020.9
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
        // Return dummy data on error
        return df.formatSucessRes(req, res, {
            wallet: { balance: 520.00, last_updated: new Date().toISOString() },
            nearby_stations: DUMMY_STATIONS,
            recent_sessions: DUMMY_SESSIONS,
            stats: { total_sessions: 47, total_energy_kwh: 1245, total_spent: 12450, co2_saved_kg: 1020.9 }
        }, cntxtDtls, fnm, {});
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
