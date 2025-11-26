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

/*****************************************************************************
* Function      : getWalletBalanceMdl
* Description   : Get user wallet balance
* Arguments     : data object with userId
******************************************************************************/
exports.getWalletBalanceMdl = function(data) {
    const QRY_TO_EXEC = `
        SELECT wllt_id, blnce_amt, lst_updtd_ts
        FROM wallet_t
        WHERE usr_id = ${data.userId}
        AND a_in = 1
        LIMIT 1`;
    
    console.log('[getWalletBalanceMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};

/*****************************************************************************
* Function      : getNearbyStationsMdl
* Description   : Get nearby stations (for home page)
* Arguments     : data object with userId, limit
******************************************************************************/
exports.getNearbyStationsMdl = function(data) {
    const limit = data.limit || 3;
    
    const QRY_TO_EXEC = `
        SELECT 
            sttn_id,
            sttn_nm_tx,
            addr_tx,
            cty_tx,
            prce_per_kwh_amt,
            ttl_chrgrs_nbr,
            avlbl_chrgrs_nbr,
            rtng_nbr,
            is_fst_chrgng_in,
            pwr_tx,
            ltde_nbr,
            lngtde_nbr,
            0 as distance
        FROM charging_stations_t
        WHERE a_in = 1
        AND avlbl_chrgrs_nbr > 0
        ORDER BY rtng_nbr DESC
        LIMIT ${limit}`;
    
    console.log('[getNearbyStationsMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};

/*****************************************************************************
* Function      : getRecentSessionsMdl
* Description   : Get recent charging sessions for user
* Arguments     : data object with userId, limit
******************************************************************************/
exports.getRecentSessionsMdl = function(data) {
    const limit = data.limit || 3;
    
    const QRY_TO_EXEC = `
        SELECT 
            s.sssn_id,
            s.sssn_cd,
            cs.sttn_nm_tx,
            s.strt_ts,
            s.end_ts,
            s.durn_mnts_nbr,
            s.enrgy_cnsmd_kwh,
            s.ttl_cst_amt,
            s.sttus_cd,
            s.i_ts
        FROM charging_sessions_t s
        LEFT JOIN charging_stations_t cs ON s.sttn_id = cs.sttn_id
        WHERE s.usr_id = ${data.userId}
        AND s.a_in = 1
        ORDER BY s.i_ts DESC
        LIMIT ${limit}`;
    
    console.log('[getRecentSessionsMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};

/*****************************************************************************
* Function      : getUserStatsMdl
* Description   : Get user statistics summary
* Arguments     : data object with userId
******************************************************************************/
exports.getUserStatsMdl = function(data) {
    const QRY_TO_EXEC = `
        SELECT 
            COUNT(sssn_id) as ttl_sssns_nbr,
            COALESCE(SUM(enrgy_cnsmd_kwh), 0) as ttl_enrgy_kwh,
            COALESCE(SUM(ttl_cst_amt), 0) as ttl_spnt_amt,
            COALESCE(SUM(enrgy_cnsmd_kwh) * 0.82, 0) as co2_svd_kg
        FROM charging_sessions_t
        WHERE usr_id = ${data.userId}
        AND a_in = 1
        AND sttus_cd = 'completed'`;
    
    console.log('[getUserStatsMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};