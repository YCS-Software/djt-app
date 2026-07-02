/**
 * Web Analytics Model
 * Powers the admin analytics dashboard (DJT HAIKA layout). All read-only
 * SELECTs against the live `*_lst_t` schema. Each method returns raw rows;
 * the controller assembles the day skeletons and final payload.
 *
 * Every method accepts an `opts` object so the dashboard filters work:
 *   { seriesDays, windowDays, partnerId }
 *   - seriesDays : number of daily buckets for the time-series charts
 *   - windowDays : date window (days) for aggregate session KPIs; >= 36500 = all-time
 *   - partnerId  : owner user id (usr_lst_t.usr_id) to scope station/session widgets
 * Station ownership is `sttn_lst_t.ownr_usr_id`; sessions/machines link via `sttn_id`.
 */

const sqldb = require(appRoot + '/config/db.config');
const dbutil = require(appRoot + '/utils/db.utils');
const cntxtDtls = "webAnalyticsMdl";

const run = (qry) => dbutil.execQuery(sqldb.MySQLConPool, qry, cntxtDtls);

// Session statuses treated as "failed/rejected".
const FAILED_STATUSES = "('failed','rejected','cancelled','error','aborted')";

// ── Filter-clause helpers (all inputs coerced to safe integers) ─────────────
const pInt = (v) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
};
// Owner filter on a query whose primary table IS sttn_lst_t.
const ownerOnStation = (pid) => (pid ? ` AND ownr_usr_id = ${pid}` : '');
// Owner filter on a query whose table has a sttn_id column (sssn_lst_t / mchn_lst_t).
const ownerViaStation = (pid) =>
    pid ? ` AND sttn_id IN (SELECT sttn_id FROM sttn_lst_t WHERE ownr_usr_id = ${pid})` : '';
// Date window on a timestamp column; omitted when "all-time".
const dateWindow = (days, col) =>
    days && days < 36500 ? ` AND ${col} >= DATE_SUB(CURDATE(), INTERVAL ${days - 1} DAY)` : '';

const opt = (o) => o || {};

/*****************************************************************************
* getSummaryMdl — the 9 KPI cards.
* Entity counts stay global; station/session KPIs honor partnerId + window.
******************************************************************************/
exports.getSummaryMdl = function(o) {
    const { partnerId, windowDays } = opt(o);
    const pid = pInt(partnerId);
    const sOwn = ownerOnStation(pid);
    const sessOwn = ownerViaStation(pid);
    const win = dateWindow(windowDays, 'strt_ts');
    const QRY = `
        SELECT
            (SELECT COUNT(*) FROM usr_lst_t WHERE a_in = 1 AND usr_typ_cd = 'owner')            AS partner_orgs,
            (SELECT COUNT(DISTINCT cty_tx) FROM sttn_lst_t WHERE a_in = 1 AND cty_tx IS NOT NULL${sOwn}) AS locations,
            (SELECT COUNT(*) FROM usr_lst_t WHERE a_in = 1 AND usr_typ_cd IN ('admin','owner'))  AS users,
            (SELECT COUNT(*) FROM sttn_lst_t WHERE a_in = 1${sOwn})                               AS charging_stations,
            (SELECT COUNT(*) FROM usr_lst_t WHERE a_in = 1 AND usr_typ_cd = 'customer')           AS ev_drivers,
            (SELECT COALESCE(SUM(blnce_amt), 0) FROM wllt_lst_t WHERE a_in = 1)                   AS wallet_balance,
            (SELECT COALESCE(SUM(ttl_cst_amt), 0) FROM sssn_lst_t WHERE sttus_cd = 'completed'${win}${sessOwn})   AS txn_amount,
            (SELECT COALESCE(SUM(enrgy_cnsmd_kwh), 0) FROM sssn_lst_t WHERE sttus_cd = 'completed'${win}${sessOwn}) AS kwh_consumption,
            (SELECT COUNT(*) FROM pay_ordr_lst_t WHERE purpose_cd = 'wallet_topup')               AS wallet_topup_count`;
    console.log('[getSummaryMdl]', { pid, windowDays });
    return run(QRY);
};

/*****************************************************************************
* getUptimeMdl — snapshot charger availability (proxy for uptime %).
******************************************************************************/
exports.getUptimeMdl = function(o) {
    const pid = pInt(opt(o).partnerId);
    const QRY = `
        SELECT ROUND(
            COALESCE(
                SUM(CASE WHEN sttus_cd = 'available' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0) * 100,
            0), 2) AS uptime_pct
        FROM mchn_lst_t
        WHERE a_in = 1${ownerViaStation(pid)}`;
    console.log('[getUptimeMdl]');
    return run(QRY);
};

/*****************************************************************************
* getChargeTimeSeriesMdl — avg charge duration (hours) per day.
******************************************************************************/
exports.getChargeTimeSeriesMdl = function(o) {
    const { seriesDays, partnerId } = opt(o);
    const days = (parseInt(seriesDays, 10) || 7) - 1;
    const QRY = `
        SELECT DATE_FORMAT(strt_ts, '%Y-%m-%d') AS period,
               COALESCE(AVG(durn_mnts_nbr), 0) / 60 AS value
        FROM sssn_lst_t
        WHERE sttus_cd = 'completed'
        AND strt_ts >= DATE_SUB(CURDATE(), INTERVAL ${days} DAY)${ownerViaStation(pInt(partnerId))}
        GROUP BY DATE_FORMAT(strt_ts, '%Y-%m-%d')`;
    console.log('[getChargeTimeSeriesMdl]');
    return run(QRY);
};

/*****************************************************************************
* getConsumptionSeriesMdl — total kWh delivered per day.
******************************************************************************/
exports.getConsumptionSeriesMdl = function(o) {
    const { seriesDays, partnerId } = opt(o);
    const days = (parseInt(seriesDays, 10) || 7) - 1;
    const QRY = `
        SELECT DATE_FORMAT(strt_ts, '%Y-%m-%d') AS period,
               COALESCE(SUM(enrgy_cnsmd_kwh), 0) AS value
        FROM sssn_lst_t
        WHERE sttus_cd = 'completed'
        AND strt_ts >= DATE_SUB(CURDATE(), INTERVAL ${days} DAY)${ownerViaStation(pInt(partnerId))}
        GROUP BY DATE_FORMAT(strt_ts, '%Y-%m-%d')`;
    console.log('[getConsumptionSeriesMdl]');
    return run(QRY);
};

/*****************************************************************************
* getFailedSeriesMdl — count of failed/rejected sessions per day.
******************************************************************************/
exports.getFailedSeriesMdl = function(o) {
    const { seriesDays, partnerId } = opt(o);
    const days = (parseInt(seriesDays, 10) || 7) - 1;
    const QRY = `
        SELECT DATE_FORMAT(i_ts, '%Y-%m-%d') AS period,
               COUNT(*) AS value
        FROM sssn_lst_t
        WHERE sttus_cd IN ${FAILED_STATUSES}
        AND i_ts >= DATE_SUB(CURDATE(), INTERVAL ${days} DAY)${ownerViaStation(pInt(partnerId))}
        GROUP BY DATE_FORMAT(i_ts, '%Y-%m-%d')`;
    console.log('[getFailedSeriesMdl]');
    return run(QRY);
};

/*****************************************************************************
* getSessionCountMdl — finished vs rejected donut (window + partner scoped).
******************************************************************************/
exports.getSessionCountMdl = function(o) {
    const { partnerId, windowDays } = opt(o);
    const win = dateWindow(windowDays, 'strt_ts');
    const QRY = `
        SELECT
            SUM(CASE WHEN sttus_cd = 'completed' THEN 1 ELSE 0 END)        AS finished,
            SUM(CASE WHEN sttus_cd IN ${FAILED_STATUSES} THEN 1 ELSE 0 END) AS rejected
        FROM sssn_lst_t
        WHERE a_in = 1${win}${ownerViaStation(pInt(partnerId))}`;
    console.log('[getSessionCountMdl]');
    return run(QRY);
};

/*****************************************************************************
* getChargerDowntimeMdl — non-available chargers bucketed by hours since
* last heartbeat (falls back to creation time when never seen).
******************************************************************************/
exports.getChargerDowntimeMdl = function(o) {
    const pid = pInt(opt(o).partnerId);
    const QRY = `
        SELECT
            SUM(CASE WHEN hrs < 12 THEN 1 ELSE 0 END)                 AS lt12,
            SUM(CASE WHEN hrs >= 12 AND hrs < 24 THEN 1 ELSE 0 END)   AS h12_24,
            SUM(CASE WHEN hrs >= 24 AND hrs < 48 THEN 1 ELSE 0 END)   AS h24_48,
            SUM(CASE WHEN hrs >= 48 THEN 1 ELSE 0 END)                AS gt48
        FROM (
            SELECT TIMESTAMPDIFF(HOUR, COALESCE(lst_hb_ts, i_ts), NOW()) AS hrs
            FROM mchn_lst_t
            WHERE a_in = 1 AND sttus_cd <> 'available'${ownerViaStation(pid)}
        ) t`;
    console.log('[getChargerDowntimeMdl]');
    return run(QRY);
};

/*****************************************************************************
* getStationsStatusMdl — station counts grouped by approval status.
******************************************************************************/
exports.getStationsStatusMdl = function(o) {
    const pid = pInt(opt(o).partnerId);
    const QRY = `
        SELECT UPPER(COALESCE(NULLIF(aprvl_sttus_cd, ''), 'UNKNOWN')) AS status,
               COUNT(*) AS count
        FROM sttn_lst_t
        WHERE a_in = 1${ownerOnStation(pid)}
        GROUP BY UPPER(COALESCE(NULLIF(aprvl_sttus_cd, ''), 'UNKNOWN'))`;
    console.log('[getStationsStatusMdl]');
    return run(QRY);
};
