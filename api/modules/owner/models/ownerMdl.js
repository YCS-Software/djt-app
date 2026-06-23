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

/*****************************************************************************
* POWER OPTIONS (master)
******************************************************************************/

exports.getPowerOptionsMdl = function() {
    const QRY_TO_EXEC = `SELECT * FROM mchn_pwr_lst_t WHERE a_in = 1 ORDER BY srt_nbr ASC`;
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};

exports.getPowerByIdMdl = function(powerId) {
    const QRY_TO_EXEC = `SELECT * FROM mchn_pwr_lst_t WHERE mchn_pwr_id = ${num(powerId)} AND a_in = 1 LIMIT 1`;
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};

// Count existing machines at a station (used for OCPP id sequence)
exports.getMachineCountMdl = function(stationId) {
    const QRY_TO_EXEC = `SELECT COUNT(*) AS cnt FROM mchn_lst_t WHERE sttn_id = ${num(stationId)} AND a_in = 1`;
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
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
        (${num(data.ownerId)}, 'active', ${esc(data.name)}, ${esc(data.code)}, ${esc(data.address)},
         ${esc(data.city)}, ${esc(data.state)}, ${esc(data.postalCode)},
         ${num(data.latitude)}, ${num(data.longitude)}, ${num(data.pricePerKwh, 0)},
         ${num(data.totalChargers, 0)}, ${num(data.availableChargers, 0)},
         ${data.isFastCharging ? 1 : 0}, ${esc(data.power)}, ${esc(data.operatorName)},
         ${esc(data.contactNumber)}, 1, NOW())`;

    console.log('[createStationMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};

// List stations owned by an owner, with machine/connector counts
exports.getStationsByOwnerMdl = function(data) {
    const QRY_TO_EXEC = `
        SELECT s.*,
            (SELECT COUNT(*) FROM mchn_lst_t m WHERE m.sttn_id = s.sttn_id AND m.a_in = 1) AS machine_count,
            (SELECT COUNT(*) FROM cnntr_lst_t c WHERE c.sttn_id = s.sttn_id AND c.a_in = 1) AS connector_count
        FROM sttn_lst_t s
        WHERE s.ownr_usr_id = ${num(data.ownerId)} AND s.a_in = 1
        ORDER BY s.i_ts DESC`;

    console.log('[getStationsByOwnerMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};

// Get a single station only if it belongs to this owner (ownership guard)
exports.getOwnedStationMdl = function(data) {
    const QRY_TO_EXEC = `SELECT * FROM sttn_lst_t
        WHERE sttn_id = ${num(data.stationId)}
        AND ownr_usr_id = ${num(data.ownerId)}
        AND a_in = 1
        LIMIT 1`;

    console.log('[getOwnedStationMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};

exports.updateStationMdl = function(data) {
    const sets = [];
    if (data.name !== undefined) sets.push(`sttn_nm_tx = ${esc(data.name)}`);
    if (data.address !== undefined) sets.push(`addr_tx = ${esc(data.address)}`);
    if (data.city !== undefined) sets.push(`cty_tx = ${esc(data.city)}`);
    if (data.state !== undefined) sets.push(`stte_tx = ${esc(data.state)}`);
    if (data.latitude !== undefined) sets.push(`ltde_nbr = ${num(data.latitude)}`);
    if (data.longitude !== undefined) sets.push(`lngtde_nbr = ${num(data.longitude)}`);
    if (data.pricePerKwh !== undefined) sets.push(`prce_per_kwh_amt = ${num(data.pricePerKwh, 0)}`);
    if (data.isFastCharging !== undefined) sets.push(`is_fst_chrgng_in = ${data.isFastCharging ? 1 : 0}`);
    if (data.power !== undefined) sets.push(`pwr_tx = ${esc(data.power)}`);
    if (data.operatorName !== undefined) sets.push(`oprtr_nm_tx = ${esc(data.operatorName)}`);
    if (data.contactNumber !== undefined) sets.push(`cntct_nbr_tx = ${esc(data.contactNumber)}`);
    sets.push('u_ts = NOW()');

    const QRY_TO_EXEC = `UPDATE sttn_lst_t SET ${sets.join(', ')}
        WHERE sttn_id = ${num(data.stationId)} AND ownr_usr_id = ${num(data.ownerId)}`;

    console.log('[updateStationMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};

// Keep station charger counters in sync with machine/connector inventory
exports.recalcStationCountersMdl = function(data) {
    const QRY_TO_EXEC = `
        UPDATE sttn_lst_t s SET
            s.ttl_chrgrs_nbr = (SELECT COUNT(*) FROM mchn_lst_t m WHERE m.sttn_id = s.sttn_id AND m.a_in = 1),
            s.avlbl_chrgrs_nbr = (SELECT COUNT(*) FROM mchn_lst_t m WHERE m.sttn_id = s.sttn_id AND m.a_in = 1 AND m.sttus_cd = 'available')
        WHERE s.sttn_id = ${num(data.stationId)}`;

    console.log('[recalcStationCountersMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};

/*****************************************************************************
* MACHINES (chargers)
******************************************************************************/

exports.createMachineMdl = function(data) {
    const QRY_TO_EXEC = `INSERT INTO mchn_lst_t
        (sttn_id, mchn_nm_tx, mchn_srl_no_tx, ocpp_id_tx, mchn_typ_cd, mchn_pwr_id, max_pwr_tx, ttl_cnntrs_nbr, sttus_cd, a_in, i_ts)
        VALUES
        (${num(data.stationId)}, ${esc(data.name)}, ${esc(data.serialNo)}, ${esc(data.ocppId)},
         ${esc(data.machineType || 'DC')}, ${num(data.powerId, 'NULL')}, ${esc(data.maxPower)}, ${num(data.totalConnectors, 2)},
         ${esc(data.status || 'available')}, 1, NOW())`;

    console.log('[createMachineMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};

exports.getMachinesByStationMdl = function(data) {
    const QRY_TO_EXEC = `SELECT m.*, p.pwr_cd, p.pwr_lbl_tx, p.kw_nbr
        FROM mchn_lst_t m
        LEFT JOIN mchn_pwr_lst_t p ON m.mchn_pwr_id = p.mchn_pwr_id
        WHERE m.sttn_id = ${num(data.stationId)} AND m.a_in = 1
        ORDER BY m.mchn_id ASC`;

    console.log('[getMachinesByStationMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};

// Get a machine joined with its station so we can verify the owner owns it
exports.getOwnedMachineMdl = function(data) {
    const QRY_TO_EXEC = `SELECT m.*, s.ownr_usr_id
        FROM mchn_lst_t m
        JOIN sttn_lst_t s ON m.sttn_id = s.sttn_id
        WHERE m.mchn_id = ${num(data.machineId)}
        AND s.ownr_usr_id = ${num(data.ownerId)}
        AND m.a_in = 1
        LIMIT 1`;

    console.log('[getOwnedMachineMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};

exports.updateMachineMdl = function(data) {
    const sets = [];
    if (data.name !== undefined) sets.push(`mchn_nm_tx = ${esc(data.name)}`);
    if (data.serialNo !== undefined) sets.push(`mchn_srl_no_tx = ${esc(data.serialNo)}`);
    if (data.ocppId !== undefined) sets.push(`ocpp_id_tx = ${esc(data.ocppId)}`);
    if (data.machineType !== undefined) sets.push(`mchn_typ_cd = ${esc(data.machineType)}`);
    if (data.maxPower !== undefined) sets.push(`max_pwr_tx = ${esc(data.maxPower)}`);
    if (data.status !== undefined) sets.push(`sttus_cd = ${esc(data.status)}`);
    sets.push('u_ts = NOW()');

    const QRY_TO_EXEC = `UPDATE mchn_lst_t SET ${sets.join(', ')}
        WHERE mchn_id = ${num(data.machineId)}`;

    console.log('[updateMachineMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};

/*****************************************************************************
* CONNECTORS
******************************************************************************/

exports.createConnectorMdl = function(data) {
    const QRY_TO_EXEC = `INSERT INTO cnntr_lst_t
        (sttn_id, mchn_id, cnntr_typ_cd, cnntr_nm_tx, pwr_tx, is_avlbl_in, a_in, i_ts)
        VALUES
        (${num(data.stationId)}, ${num(data.machineId)}, ${esc(data.connectorType)},
         ${esc(data.name)}, ${esc(data.power)}, 1, 1, NOW())`;

    console.log('[createConnectorMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};

exports.getConnectorsByMachineMdl = function(data) {
    const QRY_TO_EXEC = `SELECT * FROM cnntr_lst_t
        WHERE mchn_id = ${num(data.machineId)} AND a_in = 1
        ORDER BY cnntr_id ASC`;

    console.log('[getConnectorsByMachineMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};

/*****************************************************************************
* DASHBOARD
******************************************************************************/

exports.getOwnerDashboardMdl = function(data) {
    const ownerId = num(data.ownerId);
    const QRY_TO_EXEC = `
        SELECT
            (SELECT COUNT(*) FROM sttn_lst_t WHERE ownr_usr_id = ${ownerId} AND a_in = 1) AS total_stations,
            (SELECT COUNT(*) FROM mchn_lst_t m JOIN sttn_lst_t s ON m.sttn_id = s.sttn_id
                WHERE s.ownr_usr_id = ${ownerId} AND m.a_in = 1) AS total_machines,
            (SELECT COUNT(*) FROM cnntr_lst_t c JOIN sttn_lst_t s ON c.sttn_id = s.sttn_id
                WHERE s.ownr_usr_id = ${ownerId} AND c.a_in = 1) AS total_connectors,
            (SELECT COUNT(*) FROM mchn_lst_t m JOIN sttn_lst_t s ON m.sttn_id = s.sttn_id
                WHERE s.ownr_usr_id = ${ownerId} AND m.a_in = 1 AND m.sttus_cd = 'available') AS available_machines`;

    console.log('[getOwnerDashboardMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};
