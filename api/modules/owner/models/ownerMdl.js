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
        (sttn_id, mchn_id, cnntr_cd_tx, cnntr_typ_cd, cnntr_nm_tx, pwr_tx, is_avlbl_in, a_in, i_ts)
        VALUES
        (?, ?, ?, ?,
         ?, ?, 1, 1, NOW())`;
    const PARAMS = [numVal(data.stationId), numVal(data.machineId), escVal(data.code), escVal(data.connectorType),
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

// Count connectors on a machine (used to sequence connector codes)
exports.getConnectorCountMdl = function(data) {
    const QRY_TO_EXEC = `SELECT COUNT(*) AS cnt FROM cnntr_lst_t WHERE mchn_id = ? AND a_in = 1`;
    const PARAMS = [numVal(data.machineId)];
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

// One connector joined to its machine + station (ownership guard) for QR / detail
exports.getOwnedConnectorMdl = function(data) {
    const QRY_TO_EXEC = `SELECT c.*, m.ocpp_id_tx, m.mchn_nm_tx, m.mchn_typ_cd, m.max_pwr_tx,
            m.sttus_cd AS mchn_sttus, p.pwr_lbl_tx,
            s.sttn_id, s.sttn_nm_tx, s.prce_per_kwh_amt, s.ownr_usr_id
        FROM cnntr_lst_t c
        INNER JOIN mchn_lst_t m ON c.mchn_id = m.mchn_id
        INNER JOIN sttn_lst_t s ON m.sttn_id = s.sttn_id
        LEFT JOIN mchn_pwr_lst_t p ON m.mchn_pwr_id = p.mchn_pwr_id
        WHERE c.cnntr_id = ? AND s.ownr_usr_id = ? AND c.a_in = 1
        LIMIT 1`;
    const PARAMS = [numVal(data.connectorId), numVal(data.ownerId)];
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

// Amount credited to one account type by a session's settle journal (0 until it
// posts). Correlated on the outer query's `s.sssn_id`.
function sessionLegSubQry(acctTypCd) {
    return `
        SELECT COALESCE(SUM(l2.amt), 0)
        FROM jrnl_lst_t j2
        INNER JOIN jrnl_leg_lst_t l2 ON l2.jrnl_id = j2.jrnl_id
        INNER JOIN acct_lst_t a2 ON a2.acct_id = l2.acct_id
        WHERE j2.ref_typ_cd = 'session' AND j2.ref_id = s.sssn_id
            AND j2.jrnl_typ_cd = 'charging_payment'
            AND j2.sttus_cd = 'posted' AND j2.a_in = 1
            AND a2.acct_typ_cd = '${acctTypCd}' AND l2.drct_cd = 'credit'`;
}

const SESSION_NET_SUBQRY = sessionLegSubQry('owner_earnings');
const SESSION_CMSN_SUBQRY = sessionLegSubQry('platform_revenue');

// Recent sessions across the owner's stations (any status)
exports.getOwnerRecentTxnsMdl = function(data) {
    const ownerId = numVal(data.ownerId);
    const limit = Number.isFinite(Number(data.limit)) ? Math.max(0, parseInt(data.limit, 10)) : 8;
    const QRY_TO_EXEC = `
        SELECT s.sssn_cd, s.enrgy_cnsmd_kwh, s.durn_mnts_nbr, s.ttl_cst_amt,
            s.sttus_cd, s.pymnt_sttus_cd, s.strt_ts, s.i_ts,
            st.sttn_nm_tx, c.cnntr_nm_tx,
            (${SESSION_NET_SUBQRY}) AS net_amt
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
// `from`/`to` are optional inclusive YYYY-MM-DD bounds; omit both for all time.
// Sessions are dated by strt_ts, falling back to i_ts when a session never
// started — the same value the controller returns as `date`.
exports.getOwnerTransactionsMdl = function(data) {
    const ownerId = numVal(data.ownerId);
    const limit = Number.isFinite(Number(data.limit)) ? Math.max(0, parseInt(data.limit, 10)) : 50;

    const hasRange = Boolean(data.from && data.to);
    const dateFilter = hasRange ? `AND DATE(COALESCE(s.strt_ts, s.i_ts)) BETWEEN ? AND ?` : '';

    const QRY_TO_EXEC = `
        SELECT s.sssn_cd, s.enrgy_cnsmd_kwh, s.durn_mnts_nbr, s.ttl_cst_amt,
            s.sttus_cd, s.pymnt_sttus_cd, s.strt_ts, s.i_ts,
            st.sttn_nm_tx, c.cnntr_nm_tx, u.nm_tx AS usr_nm,
            (${SESSION_NET_SUBQRY}) AS net_amt,
            (${SESSION_CMSN_SUBQRY}) AS cmsn_amt
        FROM sssn_lst_t s
        INNER JOIN sttn_lst_t st ON s.sttn_id = st.sttn_id
        LEFT JOIN cnntr_lst_t c ON s.cnntr_id = c.cnntr_id
        LEFT JOIN usr_lst_t u ON s.usr_id = u.usr_id
        WHERE st.ownr_usr_id = ? AND s.a_in = 1
        ${dateFilter}
        ORDER BY COALESCE(s.strt_ts, s.i_ts) DESC
        LIMIT ${limit}`;
    const PARAMS = hasRange ? [ownerId, escVal(data.from), escVal(data.to)] : [ownerId];
    console.log('[getOwnerTransactionsMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

/*****************************************************************************
* NET EARNINGS (ledger truth)
*
* The owner's real income is NOT sssn_lst_t.ttl_cst_amt (that is what the driver
* paid). On stop, ledgerService.chargingSettle posts a `charging_payment` journal:
*
*     DEBIT  ESCROW_HOLD      (consumed)   <- gross
*     CREDIT OWNER_<owner>    (ownr_pct%)  <- net earnings
*     CREDIT PLATFORM_REVENUE (platfrm_pct%)
*
* So net = credit legs landing on the owner_earnings account, and
* gross = net + commission. Journals link back via ref_typ_cd='session'.
* Refunds never touch the owner account, so they need no subtraction here.
******************************************************************************/

// Shared FROM/WHERE for owner-attributed charging_payment legs.
const NET_LEG_JOIN = `
        FROM jrnl_lst_t j
        INNER JOIN jrnl_leg_lst_t l ON l.jrnl_id = j.jrnl_id
        INNER JOIN acct_lst_t a ON a.acct_id = l.acct_id
        INNER JOIN sssn_lst_t s ON s.sssn_id = j.ref_id
        INNER JOIN sttn_lst_t st ON st.sttn_id = s.sttn_id
        WHERE j.ref_typ_cd = 'session'
            AND j.jrnl_typ_cd = 'charging_payment'
            AND j.sttus_cd = 'posted'
            AND j.a_in = 1
            AND st.ownr_usr_id = ?`;

// A leg's contribution to net (owner credit) and to commission (platform credit).
const NET_EXPR = `CASE WHEN a.acct_typ_cd = 'owner_earnings'   AND l.drct_cd = 'credit' THEN l.amt ELSE 0 END`;
const CMSN_EXPR = `CASE WHEN a.acct_typ_cd = 'platform_revenue' AND l.drct_cd = 'credit' THEN l.amt ELSE 0 END`;

// Net earned today / yesterday / this month / lifetime, in one pass.
exports.getOwnerNetTotalsMdl = function(data) {
    const QRY_TO_EXEC = `
        SELECT
            COALESCE(SUM(CASE WHEN DATE(j.i_ts) = CURDATE() THEN (${NET_EXPR}) ELSE 0 END), 0) AS today_net,
            COALESCE(SUM(CASE WHEN DATE(j.i_ts) = CURDATE() THEN (${CMSN_EXPR}) ELSE 0 END), 0) AS today_cmsn,
            COALESCE(SUM(CASE WHEN DATE(j.i_ts) = DATE_SUB(CURDATE(), INTERVAL 1 DAY) THEN (${NET_EXPR}) ELSE 0 END), 0) AS yest_net,
            COALESCE(SUM(CASE WHEN j.i_ts >= DATE_FORMAT(CURDATE(), '%Y-%m-01') THEN (${NET_EXPR}) ELSE 0 END), 0) AS month_net,
            COALESCE(SUM(CASE WHEN j.i_ts >= DATE_FORMAT(CURDATE(), '%Y-%m-01') THEN (${CMSN_EXPR}) ELSE 0 END), 0) AS month_cmsn,
            COALESCE(SUM(CASE WHEN j.i_ts >= DATE_FORMAT(CURDATE() - INTERVAL 1 MONTH, '%Y-%m-01')
                              AND j.i_ts <  DATE_FORMAT(CURDATE(), '%Y-%m-01') THEN (${NET_EXPR}) ELSE 0 END), 0) AS prev_month_net,
            COALESCE(SUM(${NET_EXPR}), 0) AS lifetime_net,
            COALESCE(SUM(${CMSN_EXPR}), 0) AS lifetime_cmsn
        ${NET_LEG_JOIN}`;
    const PARAMS = [numVal(data.ownerId)];
    console.log('[getOwnerNetTotalsMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

// Hourly net-revenue series for today's sparkline (mirrors getOwnerHourlySeriesMdl).
exports.getOwnerNetHourlySeriesMdl = function(data) {
    const QRY_TO_EXEC = `
        SELECT HOUR(j.i_ts) AS hr,
            COALESCE(SUM(${NET_EXPR}), 0) AS net_amt,
            COALESCE(SUM(${CMSN_EXPR}), 0) AS cmsn_amt
        ${NET_LEG_JOIN}
            AND DATE(j.i_ts) = CURDATE()
        GROUP BY HOUR(j.i_ts)
        ORDER BY hr`;
    const PARAMS = [numVal(data.ownerId)];
    console.log('[getOwnerNetHourlySeriesMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

// Net + commission per station over an inclusive [from, to] date window.
exports.getOwnerNetByStationMdl = function(data) {
    const QRY_TO_EXEC = `
        SELECT st.sttn_id,
            COALESCE(SUM(${NET_EXPR}), 0) AS net_amt,
            COALESCE(SUM(${CMSN_EXPR}), 0) AS cmsn_amt
        ${NET_LEG_JOIN}
            AND DATE(j.i_ts) BETWEEN ? AND ?
        GROUP BY st.sttn_id`;
    const PARAMS = [numVal(data.ownerId), escVal(data.from), escVal(data.to)];
    console.log('[getOwnerNetByStationMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

// Net per station for the *previous* window of equal length (drives the trend pill).
exports.getOwnerNetByStationPrevMdl = function(data) {
    const QRY_TO_EXEC = `
        SELECT st.sttn_id, COALESCE(SUM(${NET_EXPR}), 0) AS net_amt
        ${NET_LEG_JOIN}
            AND DATE(j.i_ts) BETWEEN
                DATE_SUB(?, INTERVAL DATEDIFF(?, ?) + 1 DAY) AND DATE_SUB(?, INTERVAL 1 DAY)
        GROUP BY st.sttn_id`;
    const from = escVal(data.from), to = escVal(data.to);
    const PARAMS = [numVal(data.ownerId), from, to, from, from];
    console.log('[getOwnerNetByStationPrevMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

// Session-side usage per station (kWh, txns, charging minutes, failures, gross).
// LEFT JOIN so stations with no sessions still appear with zeroes.
exports.getOwnerStationUsageMdl = function(data) {
    const QRY_TO_EXEC = `
        SELECT st.sttn_id, st.sttn_nm_tx, st.cty_tx, st.oprtr_nm_tx, st.aprvl_sttus_cd,
            COALESCE(SUM(CASE WHEN s.sttus_cd = 'completed' THEN s.enrgy_cnsmd_kwh END), 0) AS kwh,
            COUNT(CASE WHEN s.sttus_cd = 'completed' THEN 1 END) AS txns,
            COALESCE(SUM(CASE WHEN s.sttus_cd = 'completed' THEN s.durn_mnts_nbr END), 0) AS charge_mins,
            COUNT(CASE WHEN s.sttus_cd IN ('cancelled', 'failed') THEN 1 END) AS failed_txns,
            COALESCE(SUM(CASE WHEN s.sttus_cd = 'completed' THEN s.ttl_cst_amt END), 0) AS gross_amt
        FROM sttn_lst_t st
        LEFT JOIN sssn_lst_t s
            ON s.sttn_id = st.sttn_id AND s.a_in = 1
            AND DATE(s.strt_ts) BETWEEN ? AND ?
        WHERE st.ownr_usr_id = ? AND st.a_in = 1
        GROUP BY st.sttn_id, st.sttn_nm_tx, st.cty_tx, st.oprtr_nm_tx, st.aprvl_sttus_cd`;
    const PARAMS = [escVal(data.from), escVal(data.to), numVal(data.ownerId)];
    console.log('[getOwnerStationUsageMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

// Earliest activity for this owner — the true start of a "lifetime" window.
// Falls back to when their first station was created if no session exists yet.
exports.getOwnerFirstActivityMdl = function(data) {
    const QRY_TO_EXEC = `
        SELECT LEAST(
            COALESCE((SELECT DATE(MIN(s.strt_ts)) FROM sssn_lst_t s
                      INNER JOIN sttn_lst_t st ON st.sttn_id = s.sttn_id
                      WHERE st.ownr_usr_id = ? AND s.a_in = 1), CURDATE()),
            COALESCE((SELECT DATE(MIN(i_ts)) FROM sttn_lst_t
                      WHERE ownr_usr_id = ? AND a_in = 1), CURDATE())
        ) AS first_dt`;
    const PARAMS = [numVal(data.ownerId), numVal(data.ownerId)];
    console.log('[getOwnerFirstActivityMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

// Machine health per station: counts by status + newest OCPP heartbeat.
exports.getOwnerStationHealthMdl = function(data) {
    const QRY_TO_EXEC = `
        SELECT st.sttn_id,
            COUNT(m.mchn_id) AS machines,
            COALESCE(SUM(m.sttus_cd = 'faulted'), 0) AS faulted,
            COALESCE(SUM(m.sttus_cd = 'offline'), 0) AS offline,
            COALESCE(SUM(m.sttus_cd = 'maintenance'), 0) AS maintenance,
            MAX(m.lst_hb_ts) AS last_heartbeat_ts,
            TIMESTAMPDIFF(MINUTE, MAX(m.lst_hb_ts), NOW()) AS mins_since_heartbeat
        FROM sttn_lst_t st
        LEFT JOIN mchn_lst_t m ON m.sttn_id = st.sttn_id AND m.a_in = 1
        WHERE st.ownr_usr_id = ? AND st.a_in = 1
        GROUP BY st.sttn_id`;
    const PARAMS = [numVal(data.ownerId)];
    console.log('[getOwnerStationHealthMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

/*****************************************************************************
* BALANCE, ESCROW, COMMISSION RULE, SETTLEMENTS
******************************************************************************/

// Cached balance of the owner's earnings account (credits less payouts).
exports.getOwnerBalanceMdl = function(data) {
    const QRY_TO_EXEC = `
        SELECT acct_id, blnce_amt, crncy_cd
        FROM acct_lst_t
        WHERE acct_typ_cd = 'owner_earnings' AND ownr_usr_id = ? AND a_in = 1
        LIMIT 1`;
    const PARAMS = [numVal(data.ownerId)];
    console.log('[getOwnerBalanceMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

// Money still held in escrow for this owner's in-flight sessions: holds posted
// with no settle/refund journal yet.
exports.getOwnerEscrowHeldMdl = function(data) {
    const QRY_TO_EXEC = `
        SELECT COALESCE(SUM(j.ttl_amt), 0) AS held_amt, COUNT(*) AS active_sessions
        FROM jrnl_lst_t j
        INNER JOIN sssn_lst_t s ON s.sssn_id = j.ref_id
        INNER JOIN sttn_lst_t st ON st.sttn_id = s.sttn_id
        WHERE j.ref_typ_cd = 'session'
            AND j.jrnl_typ_cd = 'charging_hold'
            AND j.sttus_cd = 'posted'
            AND j.a_in = 1
            AND st.ownr_usr_id = ?
            AND NOT EXISTS (
                SELECT 1 FROM jrnl_lst_t j2
                WHERE j2.ref_typ_cd = 'session' AND j2.ref_id = j.ref_id
                    AND j2.jrnl_typ_cd IN ('charging_payment', 'charging_refund')
                    AND j2.a_in = 1
            )`;
    const PARAMS = [numVal(data.ownerId)];
    console.log('[getOwnerEscrowHeldMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

// Effective commission rule for this owner (station overrides listed separately).
// Mirrors ledgerMdl.resolveCommissionRule's precedence: station > owner > global.
exports.getOwnerCommissionRuleMdl = function(data) {
    const QRY_TO_EXEC = `
        SELECT rule_id, scope_cd, sttn_id, ownr_pct, platfrm_pct, tax_pct
        FROM cmsn_rule_lst_t
        WHERE a_in = 1
            AND eff_frm_ts <= NOW()
            AND (eff_to_ts IS NULL OR eff_to_ts >= NOW())
            AND ((scope_cd = 'owner' AND ownr_usr_id = ?) OR scope_cd = 'global')
        ORDER BY FIELD(scope_cd, 'owner', 'global'), prirty_nbr DESC, rule_id DESC
        LIMIT 1`;
    const PARAMS = [numVal(data.ownerId)];
    console.log('[getOwnerCommissionRuleMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

// Station-scoped commission overrides, so the owner can see where their rate differs.
exports.getOwnerStationRuleOverridesMdl = function(data) {
    const QRY_TO_EXEC = `
        SELECT r.rule_id, r.sttn_id, st.sttn_nm_tx, r.ownr_pct, r.platfrm_pct, r.tax_pct
        FROM cmsn_rule_lst_t r
        INNER JOIN sttn_lst_t st ON st.sttn_id = r.sttn_id
        WHERE r.a_in = 1 AND r.scope_cd = 'station'
            AND r.eff_frm_ts <= NOW()
            AND (r.eff_to_ts IS NULL OR r.eff_to_ts >= NOW())
            AND st.ownr_usr_id = ? AND st.a_in = 1
        ORDER BY st.sttn_nm_tx`;
    const PARAMS = [numVal(data.ownerId)];
    console.log('[getOwnerStationRuleOverridesMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

// Payout history for this owner. NOTE: columns follow the live schema in
// migrations/2026_06_payment_ledger.sql (gross_amt/cmsn_amt/tax_amt/net_amt),
// not the stale names used by the admin web settlements model.
exports.getOwnerSettlementsMdl = function(data) {
    const limit = Number.isFinite(Number(data.limit)) ? Math.max(1, parseInt(data.limit, 10)) : 12;
    const QRY_TO_EXEC = `
        SELECT setlmnt_id, prd_frm_dt, prd_to_dt, gross_amt, cmsn_amt, tax_amt,
            net_amt, sttus_cd, utr_tx, i_ts, u_ts
        FROM setlmnt_lst_t
        WHERE ownr_usr_id = ?
        ORDER BY COALESCE(prd_to_dt, i_ts) DESC, setlmnt_id DESC
        LIMIT ${limit}`;
    const PARAMS = [numVal(data.ownerId)];
    console.log('[getOwnerSettlementsMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

// Energy delivered beyond the driver's prepaid hold. chargingSettle caps the
// settled amount at the hold (`if (consumed > hold) consumed = hold`), so the
// excess never passes through the ledger. The owner collects it directly at the
// machine, and keeps 100% of it — no platform commission applies. Reported as
// income, not as a discrepancy.
exports.getOwnerDirectCollectedMdl = function(data) {
    const QRY_TO_EXEC = `
        SELECT
            COALESCE(SUM(CASE WHEN DATE(s.strt_ts) = CURDATE()
                              THEN GREATEST(s.ttl_cst_amt - pay.settled_amt, 0) ELSE 0 END), 0) AS today_direct,
            COALESCE(SUM(CASE WHEN s.strt_ts >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
                              THEN GREATEST(s.ttl_cst_amt - pay.settled_amt, 0) ELSE 0 END), 0) AS month_direct,
            COALESCE(SUM(GREATEST(s.ttl_cst_amt - pay.settled_amt, 0)), 0) AS lifetime_direct,
            COUNT(CASE WHEN s.ttl_cst_amt > pay.settled_amt THEN 1 END) AS session_count
        FROM sssn_lst_t s
        INNER JOIN sttn_lst_t st ON st.sttn_id = s.sttn_id
        INNER JOIN (
            SELECT j.ref_id, SUM(CASE WHEN l.drct_cd = 'debit' THEN l.amt ELSE 0 END) AS settled_amt
            FROM jrnl_lst_t j
            INNER JOIN jrnl_leg_lst_t l ON l.jrnl_id = j.jrnl_id
            INNER JOIN acct_lst_t a ON a.acct_id = l.acct_id
            WHERE j.ref_typ_cd = 'session' AND j.jrnl_typ_cd = 'charging_payment'
                AND j.sttus_cd = 'posted' AND j.a_in = 1
                AND a.acct_typ_cd = 'escrow_hold'
            GROUP BY j.ref_id
        ) pay ON pay.ref_id = s.sssn_id
        WHERE st.ownr_usr_id = ? AND s.a_in = 1 AND s.sttus_cd = 'completed'`;
    const PARAMS = [numVal(data.ownerId)];
    console.log('[getOwnerDirectCollectedMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

// Refunds returned to drivers from this owner's sessions (context, not a deduction).
exports.getOwnerRefundsMdl = function(data) {
    const QRY_TO_EXEC = `
        SELECT
            COALESCE(SUM(CASE WHEN j.i_ts >= DATE_FORMAT(CURDATE(), '%Y-%m-01') THEN j.ttl_amt ELSE 0 END), 0) AS month_refunds,
            COALESCE(SUM(j.ttl_amt), 0) AS lifetime_refunds
        FROM jrnl_lst_t j
        INNER JOIN sssn_lst_t s ON s.sssn_id = j.ref_id
        INNER JOIN sttn_lst_t st ON st.sttn_id = s.sttn_id
        WHERE j.ref_typ_cd = 'session'
            AND j.jrnl_typ_cd = 'charging_refund'
            AND j.sttus_cd = 'posted'
            AND j.a_in = 1
            AND st.ownr_usr_id = ?`;
    const PARAMS = [numVal(data.ownerId)];
    console.log('[getOwnerRefundsMdl] Query:', QRY_TO_EXEC);
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
