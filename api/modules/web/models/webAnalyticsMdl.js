/**
 * Web Analytics Model
 * Powers the admin analytics dashboard (DJT HAIKA layout). All read-only
 * SELECTs against the live `*_lst_t` schema. Each method returns raw rows;
 * the controller assembles the 7-day skeletons and final payload.
 */

const sqldb = require(appRoot + '/config/db.config');
const dbutil = require(appRoot + '/utils/db.utils');
const cntxtDtls = "webAnalyticsMdl";

const run = (qry) => dbutil.execQuery(sqldb.MySQLConPool, qry, cntxtDtls);

// Session statuses treated as "failed/rejected".
const FAILED_STATUSES = "('failed','rejected','cancelled','error','aborted')";

/*****************************************************************************
* getSummaryMdl — the 9 KPI cards.
******************************************************************************/
exports.getSummaryMdl = function() {
    const QRY = `
        SELECT
            (SELECT COUNT(*) FROM usr_lst_t WHERE a_in = 1 AND usr_typ_cd = 'owner')            AS partner_orgs,
            (SELECT COUNT(DISTINCT cty_tx) FROM sttn_lst_t WHERE a_in = 1 AND cty_tx IS NOT NULL) AS locations,
            (SELECT COUNT(*) FROM usr_lst_t WHERE a_in = 1 AND usr_typ_cd IN ('admin','owner'))  AS users,
            (SELECT COUNT(*) FROM sttn_lst_t WHERE a_in = 1)                                      AS charging_stations,
            (SELECT COUNT(*) FROM usr_lst_t WHERE a_in = 1 AND usr_typ_cd = 'customer')           AS ev_drivers,
            (SELECT COALESCE(SUM(blnce_amt), 0) FROM wllt_lst_t WHERE a_in = 1)                   AS wallet_balance,
            (SELECT COALESCE(SUM(ttl_cst_amt), 0) FROM sssn_lst_t WHERE sttus_cd = 'completed')   AS txn_amount,
            (SELECT COALESCE(SUM(enrgy_cnsmd_kwh), 0) FROM sssn_lst_t WHERE sttus_cd = 'completed') AS kwh_consumption,
            (SELECT COUNT(*) FROM pay_ordr_lst_t WHERE purpose_cd = 'wallet_topup')               AS wallet_topup_count`;
    console.log('[getSummaryMdl]');
    return run(QRY);
};

/*****************************************************************************
* getUptimeMdl — snapshot charger availability (proxy for uptime %).
******************************************************************************/
exports.getUptimeMdl = function() {
    const QRY = `
        SELECT ROUND(
            COALESCE(
                SUM(CASE WHEN sttus_cd = 'available' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0) * 100,
            0), 2) AS uptime_pct
        FROM mchn_lst_t
        WHERE a_in = 1`;
    console.log('[getUptimeMdl]');
    return run(QRY);
};

/*****************************************************************************
* getChargeTimeSeriesMdl — avg charge duration (hours) per day.
******************************************************************************/
exports.getChargeTimeSeriesMdl = function(data) {
    const days = (parseInt(data && data.days, 10) || 7) - 1;
    const QRY = `
        SELECT DATE_FORMAT(strt_ts, '%Y-%m-%d') AS period,
               COALESCE(AVG(durn_mnts_nbr), 0) / 60 AS value
        FROM sssn_lst_t
        WHERE sttus_cd = 'completed'
        AND strt_ts >= DATE_SUB(CURDATE(), INTERVAL ${days} DAY)
        GROUP BY DATE_FORMAT(strt_ts, '%Y-%m-%d')`;
    console.log('[getChargeTimeSeriesMdl]');
    return run(QRY);
};

/*****************************************************************************
* getConsumptionSeriesMdl — total kWh delivered per day.
******************************************************************************/
exports.getConsumptionSeriesMdl = function(data) {
    const days = (parseInt(data && data.days, 10) || 7) - 1;
    const QRY = `
        SELECT DATE_FORMAT(strt_ts, '%Y-%m-%d') AS period,
               COALESCE(SUM(enrgy_cnsmd_kwh), 0) AS value
        FROM sssn_lst_t
        WHERE sttus_cd = 'completed'
        AND strt_ts >= DATE_SUB(CURDATE(), INTERVAL ${days} DAY)
        GROUP BY DATE_FORMAT(strt_ts, '%Y-%m-%d')`;
    console.log('[getConsumptionSeriesMdl]');
    return run(QRY);
};

/*****************************************************************************
* getFailedSeriesMdl — count of failed/rejected sessions per day.
******************************************************************************/
exports.getFailedSeriesMdl = function(data) {
    const days = (parseInt(data && data.days, 10) || 7) - 1;
    const QRY = `
        SELECT DATE_FORMAT(i_ts, '%Y-%m-%d') AS period,
               COUNT(*) AS value
        FROM sssn_lst_t
        WHERE sttus_cd IN ${FAILED_STATUSES}
        AND i_ts >= DATE_SUB(CURDATE(), INTERVAL ${days} DAY)
        GROUP BY DATE_FORMAT(i_ts, '%Y-%m-%d')`;
    console.log('[getFailedSeriesMdl]');
    return run(QRY);
};

/*****************************************************************************
* getSessionCountMdl — finished vs rejected donut.
******************************************************************************/
exports.getSessionCountMdl = function() {
    const QRY = `
        SELECT
            SUM(CASE WHEN sttus_cd = 'completed' THEN 1 ELSE 0 END)        AS finished,
            SUM(CASE WHEN sttus_cd IN ${FAILED_STATUSES} THEN 1 ELSE 0 END) AS rejected
        FROM sssn_lst_t
        WHERE a_in = 1`;
    console.log('[getSessionCountMdl]');
    return run(QRY);
};

/*****************************************************************************
* getChargerDowntimeMdl — non-available chargers bucketed by hours since
* last heartbeat (falls back to creation time when never seen).
******************************************************************************/
exports.getChargerDowntimeMdl = function() {
    const QRY = `
        SELECT
            SUM(CASE WHEN hrs < 12 THEN 1 ELSE 0 END)                 AS lt12,
            SUM(CASE WHEN hrs >= 12 AND hrs < 24 THEN 1 ELSE 0 END)   AS h12_24,
            SUM(CASE WHEN hrs >= 24 AND hrs < 48 THEN 1 ELSE 0 END)   AS h24_48,
            SUM(CASE WHEN hrs >= 48 THEN 1 ELSE 0 END)                AS gt48
        FROM (
            SELECT TIMESTAMPDIFF(HOUR, COALESCE(lst_hb_ts, i_ts), NOW()) AS hrs
            FROM mchn_lst_t
            WHERE a_in = 1 AND sttus_cd <> 'available'
        ) t`;
    console.log('[getChargerDowntimeMdl]');
    return run(QRY);
};

/*****************************************************************************
* getStationsStatusMdl — station counts grouped by approval status.
******************************************************************************/
exports.getStationsStatusMdl = function() {
    const QRY = `
        SELECT UPPER(COALESCE(NULLIF(aprvl_sttus_cd, ''), 'UNKNOWN')) AS status,
               COUNT(*) AS count
        FROM sttn_lst_t
        WHERE a_in = 1
        GROUP BY UPPER(COALESCE(NULLIF(aprvl_sttus_cd, ''), 'UNKNOWN'))`;
    console.log('[getStationsStatusMdl]');
    return run(QRY);
};
