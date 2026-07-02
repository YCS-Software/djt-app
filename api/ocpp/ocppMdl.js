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
