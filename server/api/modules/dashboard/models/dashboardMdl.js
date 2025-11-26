/**
 * Dashboard Model
 * Handles dashboard statistics and analytics database operations
 */

const sqldb = require(appRoot + '/config/db.config');
const dbutil = require(appRoot + '/utils/db.utils');
const cntxtDtls = "dashboardMdl";

/*****************************************************************************
* Function      : getDashboardStatsMdl
* Description   : Get dashboard statistics for user
* Arguments     : data object with userId
******************************************************************************/
exports.getDashboardStatsMdl = function(data) {
    const QRY_TO_EXEC = `
        SELECT 
            COUNT(DISTINCT s.sssn_id) as total_sessions,
            COALESCE(SUM(s.enrgy_cnsmd_kwh), 0) as total_energy,
            COALESCE(SUM(s.ttl_cst_amt), 0) as total_spent,
            COALESCE(SUM(s.enrgy_cnsmd_kwh) * 0.85, 0) as co2_saved,
            COALESCE(AVG(s.durn_mnts_nbr), 0) as avg_duration,
            COALESCE(AVG(s.ttl_cst_amt), 0) as avg_cost
        FROM charging_sessions_t s
        WHERE s.usr_id = ${data.userId}
        AND s.a_in = 1
        AND s.sttus_cd = 'completed'`;
    
    console.log('[getDashboardStatsMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};

/*****************************************************************************
* Function      : getMonthlyAnalyticsMdl
* Description   : Get monthly analytics for user
* Arguments     : data object with userId, months
******************************************************************************/
exports.getMonthlyAnalyticsMdl = function(data) {
    const months = data.months || 6;
    
    const QRY_TO_EXEC = `
        SELECT 
            DATE_FORMAT(s.strt_ts, '%Y-%m') as month,
            COUNT(s.sssn_id) as sessions,
            COALESCE(SUM(s.enrgy_cnsmd_kwh), 0) as energy,
            COALESCE(SUM(s.ttl_cst_amt), 0) as cost
        FROM charging_sessions_t s
        WHERE s.usr_id = ${data.userId}
        AND s.a_in = 1
        AND s.sttus_cd = 'completed'
        AND s.strt_ts >= DATE_SUB(CURDATE(), INTERVAL ${months} MONTH)
        GROUP BY DATE_FORMAT(s.strt_ts, '%Y-%m')
        ORDER BY month DESC`;
    
    console.log('[getMonthlyAnalyticsMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};

/*****************************************************************************
* Function      : getWeeklyActivityMdl
* Description   : Get weekly activity for user
* Arguments     : data object with userId
******************************************************************************/
exports.getWeeklyActivityMdl = function(data) {
    const QRY_TO_EXEC = `
        SELECT 
            DAYNAME(s.strt_ts) as day,
            COUNT(s.sssn_id) as sessions
        FROM charging_sessions_t s
        WHERE s.usr_id = ${data.userId}
        AND s.a_in = 1
        AND s.sttus_cd = 'completed'
        AND s.strt_ts >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        GROUP BY DAYNAME(s.strt_ts), DAYOFWEEK(s.strt_ts)
        ORDER BY DAYOFWEEK(s.strt_ts)`;
    
    console.log('[getWeeklyActivityMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};

/*****************************************************************************
* Function      : getFavoriteStationsAnalyticsMdl
* Description   : Get favorite stations analytics for user
* Arguments     : data object with userId
******************************************************************************/
exports.getFavoriteStationsAnalyticsMdl = function(data) {
    const QRY_TO_EXEC = `
        SELECT 
            cs.sttn_nm_tx as name,
            COUNT(s.sssn_id) as sessions,
            ROUND((COUNT(s.sssn_id) * 100.0 / (
                SELECT COUNT(*) 
                FROM charging_sessions_t 
                WHERE usr_id = ${data.userId} 
                AND a_in = 1 
                AND sttus_cd = 'completed'
            )), 0) as percentage
        FROM charging_sessions_t s
        INNER JOIN charging_stations_t cs ON s.sttn_id = cs.sttn_id
        WHERE s.usr_id = ${data.userId}
        AND s.a_in = 1
        AND s.sttus_cd = 'completed'
        GROUP BY cs.sttn_id, cs.sttn_nm_tx
        ORDER BY sessions DESC
        LIMIT 5`;
    
    console.log('[getFavoriteStationsAnalyticsMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};
