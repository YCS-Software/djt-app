/**
 * Owner Model
 * Station-owner operations: station CRUD, machines (chargers) and connectors.
 * Follows the existing string-interpolation query style used across the app.
 */

const sqldb = require(appRoot + '/config/db.config');
const dbutil = require(appRoot + '/utils/db.utils');
const cntxtDtls = "ownerMdl";

// --- small helpers (keep parity with the codebase's inline escaping style) ---
function esc(v) {
    if (v === undefined || v === null || v === '') return 'NULL';
    return `'${String(v).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
}
function num(v, def) {
    const n = Number(v);
    return isNaN(n) ? (def === undefined ? 'NULL' : def) : n;
}

// --- bind-value helpers (parameterized equivalents of esc()/num()) ---
// escVal: null for undefined/null/empty-string, else the string value.
function escVal(v) {
    if (v === undefined || v === null || v === '') return null;
    return String(v);
}
// numVal: numeric value, or `def` when not a number. def 'NULL'/undefined -> JS null.
function numVal(v, def) {
    const n = Number(v);
    if (!isNaN(n)) return n;
    if (def === undefined || def === 'NULL') return null;
    return def;
}

/*****************************************************************************
* POWER OPTIONS (master)
******************************************************************************/

exports.getPowerOptionsMdl = function() {
    const QRY_TO_EXEC = `SELECT * FROM mchn_pwr_lst_t WHERE a_in = 1 ORDER BY srt_nbr ASC`;
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};

exports.getPowerByIdMdl = function(powerId) {
    const QRY_TO_EXEC = `SELECT * FROM mchn_pwr_lst_t WHERE mchn_pwr_id = ? AND a_in = 1 LIMIT 1`;
    const PARAMS = [numVal(powerId)];
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

// Count existing machines at a station (used for OCPP id sequence)
exports.getMachineCountMdl = function(stationId) {
    const QRY_TO_EXEC = `SELECT COUNT(*) AS cnt FROM mchn_lst_t WHERE sttn_id = ? AND a_in = 1`;
    const PARAMS = [numVal(stationId)];
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

/*****************************************************************************
* STATIONS
******************************************************************************/

// Create a station owned by the given owner
exports.createStationMdl = function(data) {
    const QRY_TO_EXEC = `INSERT INTO sttn_lst_t
        (ownr_usr_id, aprvl_sttus_cd, sttn_nm_tx, sttn_cd, addr_tx, cty_tx, stte_tx, pstl_cd_tx,
         ltde_nbr, lngtde_nbr, prce_per_kwh_amt, ttl_chrgrs_nbr, avlbl_chrgrs_nbr,
         is_fst_chrgng_in, pwr_tx, oprtr_nm_tx, cntct_nbr_tx, a_in, i_ts)
        VALUES
        (?, 'active', ?, ?, ?,
         ?, ?, ?,
         ?, ?, ?,
         ?, ?,
         ?, ?, ?,
         ?, 1, NOW())`;
    const PARAMS = [numVal(data.ownerId), escVal(data.name), escVal(data.code), escVal(data.address),
        escVal(data.city), escVal(data.state), escVal(data.postalCode),
        numVal(data.latitude), numVal(data.longitude), numVal(data.pricePerKwh, 0),
        numVal(data.totalChargers, 0), numVal(data.availableChargers, 0),
        data.isFastCharging ? 1 : 0, escVal(data.power), escVal(data.operatorName),
        escVal(data.contactNumber)];

    console.log('[createStationMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

// List stations owned by an owner, with machine/connector counts
exports.getStationsByOwnerMdl = function(data) {
    const QRY_TO_EXEC = `
        SELECT s.*,
            (SELECT COUNT(*) FROM mchn_lst_t m WHERE m.sttn_id = s.sttn_id AND m.a_in = 1) AS machine_count,
            (SELECT COUNT(*) FROM cnntr_lst_t c WHERE c.sttn_id = s.sttn_id AND c.a_in = 1) AS connector_count
        FROM sttn_lst_t s
        WHERE s.ownr_usr_id = ? AND s.a_in = 1
        ORDER BY s.i_ts DESC`;
    const PARAMS = [numVal(data.ownerId)];

    console.log('[getStationsByOwnerMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

// Get a single station only if it belongs to this owner (ownership guard)
exports.getOwnedStationMdl = function(data) {
    const QRY_TO_EXEC = `SELECT * FROM sttn_lst_t
        WHERE sttn_id = ?
        AND ownr_usr_id = ?
        AND a_in = 1
        LIMIT 1`;
    const PARAMS = [numVal(data.stationId), numVal(data.ownerId)];

    console.log('[getOwnedStationMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

exports.updateStationMdl = function(data) {
    const sets = [];
    const PARAMS = [];
    if (data.name !== undefined) { sets.push(`sttn_nm_tx = ?`); PARAMS.push(escVal(data.name)); }
    if (data.address !== undefined) { sets.push(`addr_tx = ?`); PARAMS.push(escVal(data.address)); }
    if (data.city !== undefined) { sets.push(`cty_tx = ?`); PARAMS.push(escVal(data.city)); }
    if (data.state !== undefined) { sets.push(`stte_tx = ?`); PARAMS.push(escVal(data.state)); }
    if (data.latitude !== undefined) { sets.push(`ltde_nbr = ?`); PARAMS.push(numVal(data.latitude)); }
    if (data.longitude !== undefined) { sets.push(`lngtde_nbr = ?`); PARAMS.push(numVal(data.longitude)); }
    if (data.pricePerKwh !== undefined) { sets.push(`prce_per_kwh_amt = ?`); PARAMS.push(numVal(data.pricePerKwh, 0)); }
    if (data.isFastCharging !== undefined) { sets.push(`is_fst_chrgng_in = ?`); PARAMS.push(data.isFastCharging ? 1 : 0); }
    if (data.power !== undefined) { sets.push(`pwr_tx = ?`); PARAMS.push(escVal(data.power)); }
    if (data.operatorName !== undefined) { sets.push(`oprtr_nm_tx = ?`); PARAMS.push(escVal(data.operatorName)); }
    if (data.contactNumber !== undefined) { sets.push(`cntct_nbr_tx = ?`); PARAMS.push(escVal(data.contactNumber)); }
    sets.push('u_ts = NOW()');

    const QRY_TO_EXEC = `UPDATE sttn_lst_t SET ${sets.join(', ')}
        WHERE sttn_id = ? AND ownr_usr_id = ?`;
    PARAMS.push(numVal(data.stationId), numVal(data.ownerId));

    console.log('[updateStationMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

// Keep station charger counters in sync with machine/connector inventory
exports.recalcStationCountersMdl = function(data) {
    const QRY_TO_EXEC = `
        UPDATE sttn_lst_t s SET
            s.ttl_chrgrs_nbr = (SELECT COUNT(*) FROM mchn_lst_t m WHERE m.sttn_id = s.sttn_id AND m.a_in = 1),
            s.avlbl_chrgrs_nbr = (SELECT COUNT(*) FROM mchn_lst_t m WHERE m.sttn_id = s.sttn_id AND m.a_in = 1 AND m.sttus_cd = 'available')
        WHERE s.sttn_id = ?`;
    const PARAMS = [numVal(data.stationId)];

    console.log('[recalcStationCountersMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

/*****************************************************************************
* MACHINES (chargers)
******************************************************************************/

exports.createMachineMdl = function(data) {
    const QRY_TO_EXEC = `INSERT INTO mchn_lst_t
        (sttn_id, mchn_nm_tx, mchn_srl_no_tx, ocpp_id_tx, mchn_typ_cd, mchn_pwr_id, max_pwr_tx, ttl_cnntrs_nbr, sttus_cd, a_in, i_ts)
        VALUES
        (?, ?, ?, ?,
         ?, ?, ?, ?,
         ?, 1, NOW())`;
    const PARAMS = [numVal(data.stationId), escVal(data.name), escVal(data.serialNo), escVal(data.ocppId),
        escVal(data.machineType || 'DC'), numVal(data.powerId, 'NULL'), escVal(data.maxPower), numVal(data.totalConnectors, 2),
        escVal(data.status || 'available')];

    console.log('[createMachineMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

exports.getMachinesByStationMdl = function(data) {
    const QRY_TO_EXEC = `SELECT m.*, p.pwr_cd, p.pwr_lbl_tx, p.kw_nbr
        FROM mchn_lst_t m
        LEFT JOIN mchn_pwr_lst_t p ON m.mchn_pwr_id = p.mchn_pwr_id
        WHERE m.sttn_id = ? AND m.a_in = 1
        ORDER BY m.mchn_id ASC`;
    const PARAMS = [numVal(data.stationId)];

    console.log('[getMachinesByStationMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

// Get a machine joined with its station (ownership guard) + power tier + station name
exports.getOwnedMachineMdl = function(data) {
    const QRY_TO_EXEC = `SELECT m.*, s.ownr_usr_id, s.sttn_nm_tx, s.prce_per_kwh_amt,
            p.pwr_cd, p.pwr_lbl_tx, p.kw_nbr
        FROM mchn_lst_t m
        JOIN sttn_lst_t s ON m.sttn_id = s.sttn_id
        LEFT JOIN mchn_pwr_lst_t p ON m.mchn_pwr_id = p.mchn_pwr_id
        WHERE m.mchn_id = ?
        AND s.ownr_usr_id = ?
        AND m.a_in = 1
        LIMIT 1`;
    const PARAMS = [numVal(data.machineId), numVal(data.ownerId)];

    console.log('[getOwnedMachineMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

exports.updateMachineMdl = function(data) {
    const sets = [];
    const PARAMS = [];
    if (data.name !== undefined) { sets.push(`mchn_nm_tx = ?`); PARAMS.push(escVal(data.name)); }
    if (data.serialNo !== undefined) { sets.push(`mchn_srl_no_tx = ?`); PARAMS.push(escVal(data.serialNo)); }
    if (data.ocppId !== undefined) { sets.push(`ocpp_id_tx = ?`); PARAMS.push(escVal(data.ocppId)); }
    if (data.machineType !== undefined) { sets.push(`mchn_typ_cd = ?`); PARAMS.push(escVal(data.machineType)); }
    if (data.maxPower !== undefined) { sets.push(`max_pwr_tx = ?`); PARAMS.push(escVal(data.maxPower)); }
    if (data.status !== undefined) { sets.push(`sttus_cd = ?`); PARAMS.push(escVal(data.status)); }
    sets.push('u_ts = NOW()');

    const QRY_TO_EXEC = `UPDATE mchn_lst_t SET ${sets.join(', ')}
        WHERE mchn_id = ?`;
    PARAMS.push(numVal(data.machineId));

    console.log('[updateMachineMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

/*****************************************************************************
* CONNECTORS
******************************************************************************/

exports.createConnectorMdl = function(data) {
    const QRY_TO_EXEC = `INSERT INTO cnntr_lst_t
        (sttn_id, mchn_id, cnntr_typ_cd, cnntr_nm_tx, pwr_tx, is_avlbl_in, a_in, i_ts)
        VALUES
        (?, ?, ?,
         ?, ?, 1, 1, NOW())`;
    const PARAMS = [numVal(data.stationId), numVal(data.machineId), escVal(data.connectorType),
        escVal(data.name), escVal(data.power)];

    console.log('[createConnectorMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

exports.getConnectorsByMachineMdl = function(data) {
    const QRY_TO_EXEC = `SELECT * FROM cnntr_lst_t
        WHERE mchn_id = ? AND a_in = 1
        ORDER BY cnntr_id ASC`;
    const PARAMS = [numVal(data.machineId)];

    console.log('[getConnectorsByMachineMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

/*****************************************************************************
* DASHBOARD
******************************************************************************/

exports.getOwnerDashboardMdl = function(data) {
    const ownerId = numVal(data.ownerId);
    const QRY_TO_EXEC = `
        SELECT
            (SELECT COUNT(*) FROM sttn_lst_t WHERE ownr_usr_id = ? AND a_in = 1) AS total_stations,
            (SELECT COUNT(*) FROM mchn_lst_t m JOIN sttn_lst_t s ON m.sttn_id = s.sttn_id
                WHERE s.ownr_usr_id = ? AND m.a_in = 1) AS total_machines,
            (SELECT COUNT(*) FROM cnntr_lst_t c JOIN sttn_lst_t s ON c.sttn_id = s.sttn_id
                WHERE s.ownr_usr_id = ? AND c.a_in = 1) AS total_connectors,
            (SELECT COUNT(*) FROM mchn_lst_t m JOIN sttn_lst_t s ON m.sttn_id = s.sttn_id
                WHERE s.ownr_usr_id = ? AND m.a_in = 1 AND m.sttus_cd = 'available') AS available_machines`;
    const PARAMS = [ownerId, ownerId, ownerId, ownerId];

    console.log('[getOwnerDashboardMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

/*****************************************************************************
* ANALYTICS (owner dashboard)
* All metrics are scoped to the owner's stations via sttn_lst_t.ownr_usr_id.
******************************************************************************/

// Today vs yesterday: revenue (₹), consumption (kWh), today's completed txns
exports.getOwnerTodayTotalsMdl = function(data) {
    const ownerId = numVal(data.ownerId);
    const QRY_TO_EXEC = `
        SELECT
            COALESCE(SUM(CASE WHEN DATE(s.strt_ts) = CURDATE() THEN s.ttl_cst_amt END), 0) AS today_revenue,
            COALESCE(SUM(CASE WHEN DATE(s.strt_ts) = CURDATE() THEN s.enrgy_cnsmd_kwh END), 0) AS today_energy,
            COUNT(CASE WHEN DATE(s.strt_ts) = CURDATE() THEN 1 END) AS today_txns,
            COALESCE(SUM(CASE WHEN DATE(s.strt_ts) = DATE_SUB(CURDATE(), INTERVAL 1 DAY) THEN s.ttl_cst_amt END), 0) AS yest_revenue,
            COALESCE(SUM(CASE WHEN DATE(s.strt_ts) = DATE_SUB(CURDATE(), INTERVAL 1 DAY) THEN s.enrgy_cnsmd_kwh END), 0) AS yest_energy
        FROM sssn_lst_t s
        INNER JOIN sttn_lst_t st ON s.sttn_id = st.sttn_id
        WHERE st.ownr_usr_id = ? AND s.a_in = 1 AND s.sttus_cd = 'completed'`;
    const PARAMS = [ownerId];
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

// This-month totals (from the 1st of the current month)
exports.getOwnerMonthTotalsMdl = function(data) {
    const ownerId = numVal(data.ownerId);
    const QRY_TO_EXEC = `
        SELECT
            COALESCE(SUM(s.ttl_cst_amt), 0) AS month_revenue,
            COALESCE(SUM(s.enrgy_cnsmd_kwh), 0) AS month_energy,
            COUNT(*) AS month_txns
        FROM sssn_lst_t s
        INNER JOIN sttn_lst_t st ON s.sttn_id = st.sttn_id
        WHERE st.ownr_usr_id = ? AND s.a_in = 1 AND s.sttus_cd = 'completed'
            AND s.strt_ts >= DATE_FORMAT(CURDATE(), '%Y-%m-01')`;
    const PARAMS = [ownerId];
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

// Hourly series for today's revenue/consumption charts
exports.getOwnerHourlySeriesMdl = function(data) {
    const ownerId = numVal(data.ownerId);
    const QRY_TO_EXEC = `
        SELECT HOUR(s.strt_ts) AS hr,
            COALESCE(SUM(s.ttl_cst_amt), 0) AS revenue,
            COALESCE(SUM(s.enrgy_cnsmd_kwh), 0) AS energy
        FROM sssn_lst_t s
        INNER JOIN sttn_lst_t st ON s.sttn_id = st.sttn_id
        WHERE st.ownr_usr_id = ? AND s.a_in = 1 AND s.sttus_cd = 'completed'
            AND DATE(s.strt_ts) = CURDATE()
        GROUP BY HOUR(s.strt_ts)
        ORDER BY hr`;
    const PARAMS = [ownerId];
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

// Per-station machine-status rollup (drives the Station Status donut)
exports.getOwnerStationStatusMdl = function(data) {
    const ownerId = numVal(data.ownerId);
    const QRY_TO_EXEC = `
        SELECT st.sttn_id, st.aprvl_sttus_cd,
            COALESCE(SUM(m.sttus_cd = 'faulted'), 0) AS faulted,
            COALESCE(SUM(m.sttus_cd = 'maintenance'), 0) AS maintenance,
            COALESCE(SUM(m.sttus_cd = 'offline'), 0) AS offline,
            COALESCE(SUM(m.sttus_cd IN ('available', 'in_use')), 0) AS active,
            COUNT(m.mchn_id) AS total_machines
        FROM sttn_lst_t st
        LEFT JOIN mchn_lst_t m ON m.sttn_id = st.sttn_id AND m.a_in = 1
        WHERE st.ownr_usr_id = ? AND st.a_in = 1
        GROUP BY st.sttn_id, st.aprvl_sttus_cd`;
    const PARAMS = [ownerId];
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

// Recent sessions across the owner's stations (any status)
exports.getOwnerRecentTxnsMdl = function(data) {
    const ownerId = numVal(data.ownerId);
    const limit = Number.isFinite(Number(data.limit)) ? Math.max(0, parseInt(data.limit, 10)) : 8;
    const QRY_TO_EXEC = `
        SELECT s.sssn_cd, s.enrgy_cnsmd_kwh, s.durn_mnts_nbr, s.ttl_cst_amt,
            s.sttus_cd, s.strt_ts, s.i_ts,
            st.sttn_nm_tx, c.cnntr_nm_tx
        FROM sssn_lst_t s
        INNER JOIN sttn_lst_t st ON s.sttn_id = st.sttn_id
        LEFT JOIN cnntr_lst_t c ON s.cnntr_id = c.cnntr_id
        WHERE st.ownr_usr_id = ? AND s.a_in = 1
        ORDER BY s.i_ts DESC
        LIMIT ${limit}`;
    const PARAMS = [ownerId];
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

// --- Per-station summary (station profile cards) ---
exports.getStationTodayTotalsMdl = function(data) {
    const stationId = numVal(data.stationId);
    const QRY_TO_EXEC = `
        SELECT
            COALESCE(SUM(CASE WHEN DATE(strt_ts) = CURDATE() THEN ttl_cst_amt END), 0) AS today_revenue,
            COALESCE(SUM(CASE WHEN DATE(strt_ts) = CURDATE() THEN enrgy_cnsmd_kwh END), 0) AS today_energy,
            COUNT(CASE WHEN DATE(strt_ts) = CURDATE() THEN 1 END) AS today_sessions,
            COALESCE(SUM(CASE WHEN DATE(strt_ts) = DATE_SUB(CURDATE(), INTERVAL 1 DAY) THEN ttl_cst_amt END), 0) AS yest_revenue,
            COALESCE(SUM(CASE WHEN DATE(strt_ts) = DATE_SUB(CURDATE(), INTERVAL 1 DAY) THEN enrgy_cnsmd_kwh END), 0) AS yest_energy
        FROM sssn_lst_t
        WHERE sttn_id = ? AND a_in = 1 AND sttus_cd = 'completed'`;
    const PARAMS = [stationId];
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

exports.getStationMonthTotalsMdl = function(data) {
    const stationId = numVal(data.stationId);
    const QRY_TO_EXEC = `
        SELECT
            COALESCE(SUM(ttl_cst_amt), 0) AS month_revenue,
            COALESCE(SUM(enrgy_cnsmd_kwh), 0) AS month_energy,
            COUNT(*) AS month_sessions
        FROM sssn_lst_t
        WHERE sttn_id = ? AND a_in = 1 AND sttus_cd = 'completed'
            AND strt_ts >= DATE_FORMAT(CURDATE(), '%Y-%m-01')`;
    const PARAMS = [stationId];
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

exports.getStationLifetimeMdl = function(data) {
    const stationId = numVal(data.stationId);
    const QRY_TO_EXEC = `
        SELECT
            COALESCE(SUM(ttl_cst_amt), 0) AS total_revenue,
            COALESCE(SUM(enrgy_cnsmd_kwh), 0) AS total_energy,
            COUNT(*) AS total_sessions,
            COALESCE(AVG(durn_mnts_nbr), 0) AS avg_duration
        FROM sssn_lst_t
        WHERE sttn_id = ? AND a_in = 1 AND sttus_cd = 'completed'`;
    const PARAMS = [stationId];
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

// Machine/connector inventory + availability for one station
exports.getStationInventoryMdl = function(data) {
    const stationId = numVal(data.stationId);
    const QRY_TO_EXEC = `
        SELECT
            (SELECT COUNT(*) FROM mchn_lst_t WHERE sttn_id = ? AND a_in = 1) AS machines,
            (SELECT COUNT(*) FROM mchn_lst_t WHERE sttn_id = ? AND a_in = 1 AND sttus_cd = 'available') AS available_machines,
            (SELECT COUNT(*) FROM cnntr_lst_t WHERE sttn_id = ? AND a_in = 1) AS connectors`;
    const PARAMS = [stationId, stationId, stationId];
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

// --- Per-machine summary (machine profile cards) ---
// Sessions link to a machine through their connector (cnntr_lst_t.mchn_id).
exports.getMachineTodayTotalsMdl = function(data) {
    const machineId = numVal(data.machineId);
    const QRY_TO_EXEC = `
        SELECT
            COALESCE(SUM(CASE WHEN DATE(s.strt_ts) = CURDATE() THEN s.ttl_cst_amt END), 0) AS today_revenue,
            COALESCE(SUM(CASE WHEN DATE(s.strt_ts) = CURDATE() THEN s.enrgy_cnsmd_kwh END), 0) AS today_energy,
            COUNT(CASE WHEN DATE(s.strt_ts) = CURDATE() THEN 1 END) AS today_sessions,
            COALESCE(SUM(CASE WHEN DATE(s.strt_ts) = DATE_SUB(CURDATE(), INTERVAL 1 DAY) THEN s.ttl_cst_amt END), 0) AS yest_revenue,
            COALESCE(SUM(CASE WHEN DATE(s.strt_ts) = DATE_SUB(CURDATE(), INTERVAL 1 DAY) THEN s.enrgy_cnsmd_kwh END), 0) AS yest_energy
        FROM sssn_lst_t s
        INNER JOIN cnntr_lst_t c ON s.cnntr_id = c.cnntr_id
        WHERE c.mchn_id = ? AND s.a_in = 1 AND s.sttus_cd = 'completed'`;
    const PARAMS = [machineId];
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

exports.getMachineMonthTotalsMdl = function(data) {
    const machineId = numVal(data.machineId);
    const QRY_TO_EXEC = `
        SELECT
            COALESCE(SUM(s.ttl_cst_amt), 0) AS month_revenue,
            COALESCE(SUM(s.enrgy_cnsmd_kwh), 0) AS month_energy,
            COUNT(*) AS month_sessions
        FROM sssn_lst_t s
        INNER JOIN cnntr_lst_t c ON s.cnntr_id = c.cnntr_id
        WHERE c.mchn_id = ? AND s.a_in = 1 AND s.sttus_cd = 'completed'
            AND s.strt_ts >= DATE_FORMAT(CURDATE(), '%Y-%m-01')`;
    const PARAMS = [machineId];
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

exports.getMachineLifetimeMdl = function(data) {
    const machineId = numVal(data.machineId);
    const QRY_TO_EXEC = `
        SELECT
            COALESCE(SUM(s.ttl_cst_amt), 0) AS total_revenue,
            COALESCE(SUM(s.enrgy_cnsmd_kwh), 0) AS total_energy,
            COUNT(*) AS total_sessions,
            COALESCE(AVG(s.durn_mnts_nbr), 0) AS avg_duration,
            MAX(s.strt_ts) AS last_session_ts
        FROM sssn_lst_t s
        INNER JOIN cnntr_lst_t c ON s.cnntr_id = c.cnntr_id
        WHERE c.mchn_id = ? AND s.a_in = 1 AND s.sttus_cd = 'completed'`;
    const PARAMS = [machineId];
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

// Full transactions list across the owner's stations (for the Transactions page)
exports.getOwnerTransactionsMdl = function(data) {
    const ownerId = numVal(data.ownerId);
    const limit = Number.isFinite(Number(data.limit)) ? Math.max(0, parseInt(data.limit, 10)) : 50;
    const QRY_TO_EXEC = `
        SELECT s.sssn_cd, s.enrgy_cnsmd_kwh, s.durn_mnts_nbr, s.ttl_cst_amt,
            s.sttus_cd, s.pymnt_sttus_cd, s.strt_ts, s.i_ts,
            st.sttn_nm_tx, c.cnntr_nm_tx, u.nm_tx AS usr_nm
        FROM sssn_lst_t s
        INNER JOIN sttn_lst_t st ON s.sttn_id = st.sttn_id
        LEFT JOIN cnntr_lst_t c ON s.cnntr_id = c.cnntr_id
        LEFT JOIN usr_lst_t u ON s.usr_id = u.usr_id
        WHERE st.ownr_usr_id = ? AND s.a_in = 1
        ORDER BY s.i_ts DESC
        LIMIT ${limit}`;
    const PARAMS = [ownerId];
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

// Day-over-day growth for the top stat cards (counts now vs counts existing before today)
exports.getOwnerCountTrendsMdl = function(data) {
    const ownerId = numVal(data.ownerId);
    const QRY_TO_EXEC = `
        SELECT
            (SELECT COUNT(*) FROM sttn_lst_t WHERE ownr_usr_id = ? AND a_in = 1 AND DATE(i_ts) < CURDATE()) AS stations_prev,
            (SELECT COUNT(*) FROM mchn_lst_t m JOIN sttn_lst_t s ON m.sttn_id = s.sttn_id
                WHERE s.ownr_usr_id = ? AND m.a_in = 1 AND DATE(m.i_ts) < CURDATE()) AS machines_prev,
            (SELECT COUNT(*) FROM cnntr_lst_t c JOIN sttn_lst_t s ON c.sttn_id = s.sttn_id
                WHERE s.ownr_usr_id = ? AND c.a_in = 1 AND DATE(c.i_ts) < CURDATE()) AS connectors_prev`;
    const PARAMS = [ownerId, ownerId, ownerId];
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};
