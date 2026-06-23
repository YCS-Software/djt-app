/**
 * Web Dashboard Model
 * Admin web console (djt-web) dashboard — global/network-wide queries against
 * the live `*_lst_t` schema. Read-only SELECTs only.
 */

const sqldb = require(appRoot + '/config/db.config');
const dbutil = require(appRoot + '/utils/db.utils');
const cntxtDtls = "webDashboardMdl";

/*****************************************************************************
* Function      : getOverviewMdl
* Description   : Network-wide KPI cards — stations, connectors, active
*                 sessions, drivers, and today's energy/revenue.
******************************************************************************/
exports.getOverviewMdl = function() {
    const QRY_TO_EXEC = `
        SELECT
            (SELECT COUNT(*) FROM sttn_lst_t WHERE a_in = 1)                                 AS total_stations,
            (SELECT COUNT(*) FROM sttn_lst_t WHERE a_in = 1 AND aprvl_sttus_cd = 'active')   AS online_stations,
            (SELECT COUNT(*) FROM cnntr_lst_t WHERE a_in = 1)                                 AS total_connectors,
            (SELECT COUNT(*) FROM sssn_lst_t WHERE sttus_cd = 'active')                       AS active_sessions,
            (SELECT COUNT(*) FROM usr_lst_t WHERE a_in = 1 AND usr_typ_cd = 'customer')       AS total_drivers,
            (SELECT COUNT(*) FROM sssn_lst_t
                WHERE sttus_cd = 'completed' AND DATE(strt_ts) = CURDATE())                   AS today_sessions,
            (SELECT COALESCE(SUM(enrgy_cnsmd_kwh), 0) FROM sssn_lst_t
                WHERE sttus_cd = 'completed' AND DATE(strt_ts) = CURDATE())                   AS today_energy,
            (SELECT COALESCE(SUM(ttl_cst_amt), 0) FROM sssn_lst_t
                WHERE sttus_cd = 'completed' AND DATE(strt_ts) = CURDATE())                   AS today_revenue`;

    console.log('[getOverviewMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};

/*****************************************************************************
* Function      : getSessionTrendsMdl
* Description   : Daily completed-session counts, energy and revenue for the
*                 last N days (default 7).
* Arguments     : data object with days
******************************************************************************/
exports.getSessionTrendsMdl = function(data) {
    const days = parseInt(data && data.days, 10) || 7;

    const QRY_TO_EXEC = `
        SELECT
            DATE_FORMAT(strt_ts, '%Y-%m-%d') AS period,
            COUNT(*)                          AS sessions,
            COALESCE(SUM(enrgy_cnsmd_kwh), 0) AS energy,
            COALESCE(SUM(ttl_cst_amt), 0)     AS revenue
        FROM sssn_lst_t
        WHERE sttus_cd = 'completed'
        AND strt_ts >= DATE_SUB(CURDATE(), INTERVAL ${days} DAY)
        GROUP BY DATE_FORMAT(strt_ts, '%Y-%m-%d')
        ORDER BY period`;

    console.log('[getSessionTrendsMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};

/*****************************************************************************
* Function      : getStationStatusMdl
* Description   : Online/offline machine counts and total connectors (by
*                 charger availability).
******************************************************************************/
exports.getStationStatusMdl = function() {
    const QRY_TO_EXEC = `
        SELECT
            SUM(CASE WHEN sttus_cd = 'available' THEN 1 ELSE 0 END) AS online,
            SUM(CASE WHEN sttus_cd <> 'available' THEN 1 ELSE 0 END) AS offline,
            (SELECT COUNT(*) FROM cnntr_lst_t WHERE a_in = 1)        AS total_connectors
        FROM mchn_lst_t
        WHERE a_in = 1`;

    console.log('[getStationStatusMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};

/*****************************************************************************
* Function      : getTopStationsMdl
* Description   : Stations ranked by completed-session revenue.
* Arguments     : data object with limit
******************************************************************************/
exports.getTopStationsMdl = function(data) {
    const limit = parseInt(data && data.limit, 10) || 5;

    const QRY_TO_EXEC = `
        SELECT
            s.sttn_id                       AS stationId,
            st.sttn_nm_tx                   AS name,
            COUNT(*)                        AS sessionCount,
            COALESCE(SUM(s.ttl_cst_amt), 0) AS totalRevenue
        FROM sssn_lst_t s
        JOIN sttn_lst_t st ON st.sttn_id = s.sttn_id
        WHERE s.sttus_cd = 'completed'
        GROUP BY s.sttn_id, st.sttn_nm_tx
        ORDER BY totalRevenue DESC
        LIMIT ${limit}`;

    console.log('[getTopStationsMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};

/*****************************************************************************
* Function      : getLiveSessionsMdl
* Description   : Currently-active charging sessions with station & driver.
******************************************************************************/
exports.getLiveSessionsMdl = function() {
    const QRY_TO_EXEC = `
        SELECT
            s.sssn_id          AS id,
            st.sttn_nm_tx      AS station_name,
            u.nm_tx            AS driver_name,
            s.enrgy_cnsmd_kwh  AS energy,
            s.prgrss_pct       AS progress,
            s.sttus_cd         AS status,
            s.strt_ts          AS started_at
        FROM sssn_lst_t s
        JOIN sttn_lst_t st ON st.sttn_id = s.sttn_id
        JOIN usr_lst_t  u  ON u.usr_id  = s.usr_id
        WHERE s.sttus_cd = 'active'
        ORDER BY s.strt_ts DESC`;

    console.log('[getLiveSessionsMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};

/*****************************************************************************
* Function      : getRecentActivityMdl
* Description   : Most recent charging sessions across the network (activity
*                 feed).
* Arguments     : data object with limit
******************************************************************************/
exports.getRecentActivityMdl = function(data) {
    const limit = parseInt(data && data.limit, 10) || 10;

    const QRY_TO_EXEC = `
        SELECT
            s.sssn_id      AS id,
            st.sttn_nm_tx  AS station_name,
            u.nm_tx        AS user_name,
            s.ttl_cst_amt  AS amount,
            s.sttus_cd     AS status,
            s.i_ts         AS timestamp
        FROM sssn_lst_t s
        LEFT JOIN sttn_lst_t st ON st.sttn_id = s.sttn_id
        LEFT JOIN usr_lst_t  u  ON u.usr_id  = s.usr_id
        WHERE s.a_in = 1
        ORDER BY s.i_ts DESC
        LIMIT ${limit}`;

    console.log('[getRecentActivityMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};
