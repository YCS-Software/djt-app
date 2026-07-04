/**
 * OCPP Model
 * DB operations for the OCPP 2.0.1 layer: machine lookup/state, idToken->user
 * resolution, and charger-initiated charging sessions.
 */

const sqldb = require(appRoot + '/config/db.config');
const dbutil = require(appRoot + '/utils/db.utils');
const cntxtDtls = "ocppMdl";

function esc(v) {
    if (v === undefined || v === null || v === '') return 'NULL';
    return `'${String(v).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
}
function num(v, def) {
    const n = Number(v);
    return isNaN(n) ? (def === undefined ? 'NULL' : def) : n;
}

// Helper: mirror esc() value semantics for bind params (''/undefined/null -> SQL NULL)
function escVal(v) {
    if (v === undefined || v === null || v === '') return null;
    return String(v);
}
// Helper: mirror num() value semantics for bind params (non-numeric -> def, else NULL)
function numVal(v, def) {
    const n = Number(v);
    return isNaN(n) ? (def === undefined ? null : def) : n;
}

// Resolve a machine (+ its station price) by the OCPP ChargePoint identity
exports.getMachineByOcppIdMdl = function(ocppId) {
    const QRY_TO_EXEC = `
        SELECT m.*, s.sttn_id, s.prce_per_kwh_amt, s.ownr_usr_id, s.sttn_nm_tx
        FROM mchn_lst_t m
        JOIN sttn_lst_t s ON m.sttn_id = s.sttn_id
        WHERE m.ocpp_id_tx = ? AND m.a_in = 1
        LIMIT 1`;
    const PARAMS = [escVal(ocppId)];
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

// Update machine operational status
exports.setMachineStatusMdl = function(machineId, status) {
    const QRY_TO_EXEC = `UPDATE mchn_lst_t SET sttus_cd = ?, u_ts = NOW()
        WHERE mchn_id = ?`;
    const PARAMS = [escVal(status), numVal(machineId)];
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

// Record a heartbeat / boot (online tracking); optionally also set status
exports.touchMachineMdl = function(machineId, status) {
    const PARAMS = [];
    let setStatus = '';
    if (status) {
        setStatus = `, sttus_cd = ?`;
        PARAMS.push(escVal(status));
    }
    const QRY_TO_EXEC = `UPDATE mchn_lst_t SET lst_hb_ts = NOW()${setStatus}, u_ts = NOW()
        WHERE mchn_id = ?`;
    PARAMS.push(numVal(machineId));
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

// First active connector on a machine (fallback when evse/connectorId not mapped)
exports.getFirstConnectorForMachineMdl = function(machineId) {
    const QRY_TO_EXEC = `SELECT * FROM cnntr_lst_t
        WHERE mchn_id = ? AND a_in = 1
        ORDER BY cnntr_id ASC LIMIT 1`;
    const PARAMS = [numVal(machineId)];
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

// Set connector availability flag
exports.setConnectorAvailabilityMdl = function(machineId, isAvailable) {
    const QRY_TO_EXEC = `UPDATE cnntr_lst_t SET is_avlbl_in = ?
        WHERE mchn_id = ?`;
    const PARAMS = [isAvailable ? 1 : 0, numVal(machineId)];
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

// --- Per-connector status (drives per-connector plug-in/out) ---

// All active connectors of a machine, in OCPP connectorId order (1-based).
exports.getMachineConnectorsMdl = function(machineId) {
    const QRY_TO_EXEC = `SELECT cnntr_id, cnntr_cd_tx FROM cnntr_lst_t
        WHERE mchn_id = ? AND a_in = 1 ORDER BY cnntr_id ASC`;
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, [numVal(machineId)], cntxtDtls);
};

// Update ONE connector's status + availability (from its StatusNotification).
exports.updateConnectorStatusMdl = function(connectorId, statusCode, isAvailable) {
    const QRY_TO_EXEC = `UPDATE cnntr_lst_t SET cnntr_sttus_cd = ?, is_avlbl_in = ?
        WHERE cnntr_id = ?`;
    const PARAMS = [escVal(statusCode), isAvailable ? 1 : 0, numVal(connectorId)];
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

// Roll the machine's status up from its connectors (any faulted → faulted,
// any occupied/charging → in_use, else available). Keeps machine badge sane.
exports.recalcMachineStatusMdl = function(machineId) {
    const QRY_TO_EXEC = `
        UPDATE mchn_lst_t m
        SET m.sttus_cd = (
            SELECT CASE
                WHEN SUM(c.cnntr_sttus_cd = 'faulted') > 0 THEN 'faulted'
                WHEN SUM(c.cnntr_sttus_cd IN ('occupied', 'charging', 'reserved')) > 0 THEN 'in_use'
                ELSE 'available'
            END
            FROM cnntr_lst_t c WHERE c.mchn_id = m.mchn_id AND c.a_in = 1
        ), m.u_ts = NOW()
        WHERE m.mchn_id = ? AND m.sttus_cd NOT IN ('maintenance', 'offline')`;
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, [numVal(machineId)], cntxtDtls);
};

// Resolve an OCPP idToken to an app user.
// Demo mapping: the idToken value matches a user's phone number, or a numeric user id.
exports.getUserByIdTokenMdl = function(token) {
    const t = String(token || '');
    const PARAMS = [escVal(t)];
    let byId = '';
    if (/^\d+$/.test(t)) {
        byId = ` OR usr_id = ?`;
        PARAMS.push(numVal(t));
    }
    const QRY_TO_EXEC = `SELECT * FROM usr_lst_t
        WHERE (phn_nmbr_tx = ?${byId}) AND a_in = 1
        LIMIT 1`;
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

// Create an active charger-initiated session
exports.createOcppSessionMdl = function(data) {
    const QRY_TO_EXEC = `INSERT INTO sssn_lst_t
        (sssn_cd, usr_id, sttn_id, cnntr_id, strt_ts, prce_per_kwh_amt, ocpp_txn_id_tx,
         prgrss_pct, sttus_cd, pymnt_sttus_cd, a_in, i_ts)
        VALUES
        (?, ?, ?, ?,
         NOW(), ?, ?,
         0, 'active', 'pending', 1, NOW())`;
    const PARAMS = [
        escVal(data.sessionCode),
        numVal(data.userId),
        numVal(data.stationId),
        numVal(data.connectorId),
        numVal(data.pricePerKwh, 0),
        escVal(data.ocppTxnId),
    ];
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

// Look up a session by its OCPP transaction id (most recent, not yet completed)
exports.getSessionByOcppTxnMdl = function(ocppTxnId) {
    const QRY_TO_EXEC = `SELECT * FROM sssn_lst_t
        WHERE ocpp_txn_id_tx = ? AND a_in = 1
        ORDER BY sssn_id DESC LIMIT 1`;
    const PARAMS = [escVal(ocppTxnId)];
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

// A recent app-initiated session on this connector that hasn't been linked to an
// OCPP transaction yet — so a RemoteStart's TransactionEvent updates it instead
// of creating a duplicate. Matches active sessions started in the last 5 minutes.
exports.getUnlinkedSessionForConnectorMdl = function(connectorId) {
    const QRY_TO_EXEC = `SELECT * FROM sssn_lst_t
        WHERE cnntr_id = ? AND a_in = 1 AND sttus_cd = 'active'
          AND (ocpp_txn_id_tx IS NULL OR ocpp_txn_id_tx = '')
          AND i_ts >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
        ORDER BY sssn_id DESC LIMIT 1`;
    const PARAMS = [numVal(connectorId)];
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

// Link an existing session to the charger's OCPP transaction id.
exports.attachOcppTxnMdl = function(sessionId, ocppTxnId) {
    const QRY_TO_EXEC = `UPDATE sssn_lst_t SET ocpp_txn_id_tx = ?, u_ts = NOW() WHERE sssn_id = ?`;
    const PARAMS = [escVal(ocppTxnId), numVal(sessionId)];
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

// Station owner (for splitting the settlement when a charger ends a prepaid txn).
exports.getStationOwnerMdl = function(stationId) {
    const QRY_TO_EXEC = `SELECT ownr_usr_id FROM sttn_lst_t WHERE sttn_id = ? LIMIT 1`;
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, [numVal(stationId)], cntxtDtls);
};

// Live progress update during a transaction
exports.updateOcppSessionProgressMdl = function(data) {
    const QRY_TO_EXEC = `UPDATE sssn_lst_t SET
        enrgy_cnsmd_kwh = ?,
        ttl_cst_amt = ?,
        prgrss_pct = ?
        WHERE sssn_id = ?`;
    const PARAMS = [
        numVal(data.energyKwh, 0),
        numVal(data.cost, 0),
        numVal(data.progress, 0),
        numVal(data.sessionId),
    ];
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

// Finalize a transaction
exports.finalizeOcppSessionMdl = function(data) {
    const QRY_TO_EXEC = `UPDATE sssn_lst_t SET
        sttus_cd = 'completed',
        end_ts = NOW(),
        durn_mnts_nbr = TIMESTAMPDIFF(MINUTE, strt_ts, NOW()),
        enrgy_cnsmd_kwh = ?,
        ttl_cst_amt = ?,
        prgrss_pct = 100
        WHERE sssn_id = ?`;
    const PARAMS = [
        numVal(data.energyKwh, 0),
        numVal(data.cost, 0),
        numVal(data.sessionId),
    ];
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

// Mark session payment status (+ optional wallet txn link)
exports.setSessionPaymentMdl = function(data) {
    const PARAMS = [];
    let setClause = `pymnt_sttus_cd = ?`;
    PARAMS.push(escVal(data.status));
    if (data.transactionId) {
        setClause += `, wllt_trxn_id = ?`;
        PARAMS.push(numVal(data.transactionId));
    }
    const QRY_TO_EXEC = `UPDATE sssn_lst_t SET ${setClause} WHERE sssn_id = ?`;
    PARAMS.push(numVal(data.sessionId));
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};
