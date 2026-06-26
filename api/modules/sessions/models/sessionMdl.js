/**
 * Session Model
 * Handles session-related database operations
 */

const sqldb = require(appRoot + '/config/db.config');
const dbutil = require(appRoot + '/utils/db.utils');
const cntxtDtls = "sessionMdl";

/*****************************************************************************
* Function      : createSessionMdl
* Description   : Create new charging session
* Arguments     : data object with sessionCode, userId, stationId, connectorId, pricePerKwh, qrCode
******************************************************************************/
exports.createSessionMdl = function(data) {
    const qrCode = data.qrCode ? String(data.qrCode) : null;
    const QRY_TO_EXEC = `INSERT INTO sssn_lst_t
        (sssn_cd, usr_id, sttn_id, cnntr_id, prce_per_kwh_amt, qr_cd_tx, sttus_cd, pymnt_sttus_cd, a_in)
        VALUES
        (?, ?, ?, ?,
         ?, ?, 'initiated', 'pending', 1)`;
    const PARAMS = [String(data.sessionCode), data.userId, data.stationId, data.connectorId,
        data.pricePerKwh, qrCode];

    console.log('[createSessionMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

/*****************************************************************************
* Function      : startSessionMdl
* Description   : Start charging session (update status to active)
* Arguments     : data object with sessionId
******************************************************************************/
exports.startSessionMdl = function(data) {
    const QRY_TO_EXEC = `UPDATE sssn_lst_t
        SET sttus_cd = 'active',
            strt_ts = NOW()
        WHERE sssn_id = ?`;
    const PARAMS = [data.sessionId];

    console.log('[startSessionMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

/*****************************************************************************
* Function      : stopSessionMdl
* Description   : Stop charging session (update status to completed)
* Arguments     : data object with sessionId, energyConsumed, totalCost
******************************************************************************/
exports.stopSessionMdl = function(data) {
    const QRY_TO_EXEC = `UPDATE sssn_lst_t
        SET sttus_cd = 'completed',
            end_ts = NOW(),
            durn_mnts_nbr = TIMESTAMPDIFF(MINUTE, strt_ts, NOW()),
            enrgy_cnsmd_kwh = ?,
            ttl_cst_amt = ?,
            prgrss_pct = 100
        WHERE sssn_id = ?`;
    const PARAMS = [data.energyConsumed, data.totalCost, data.sessionId];

    console.log('[stopSessionMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

/*****************************************************************************
* Function      : updateProgressMdl
* Description   : Update session progress
* Arguments     : data object with sessionId, progress, energyConsumed, currentCost
******************************************************************************/
exports.updateProgressMdl = function(data) {
    const QRY_TO_EXEC = `UPDATE sssn_lst_t
        SET prgrss_pct = ?,
            enrgy_cnsmd_kwh = ?,
            ttl_cst_amt = ?
        WHERE sssn_id = ?`;
    const PARAMS = [data.progress, data.energyConsumed, data.currentCost, data.sessionId];

    console.log('[updateProgressMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

/*****************************************************************************
* Function      : getSessionByIdMdl
* Description   : Get session by ID
* Arguments     : data object with sessionId
******************************************************************************/
exports.getSessionByIdMdl = function(data) {
    const QRY_TO_EXEC = `SELECT * FROM sssn_lst_t
        WHERE sssn_id = ?
        AND a_in = 1
        LIMIT 1`;
    const PARAMS = [data.sessionId];

    console.log('[getSessionByIdMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

/*****************************************************************************
* Function      : getSessionByCodeMdl
* Description   : Get session by code
* Arguments     : data object with sessionCode
******************************************************************************/
exports.getSessionByCodeMdl = function(data) {
    const sessionCode = String(data.sessionCode);
    const QRY_TO_EXEC = `SELECT * FROM sssn_lst_t
        WHERE sssn_cd = ?
        AND a_in = 1
        LIMIT 1`;
    const PARAMS = [sessionCode];

    console.log('[getSessionByCodeMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

/*****************************************************************************
* Function      : getActiveSessionMdl
* Description   : Get active session for user
* Arguments     : data object with userId
******************************************************************************/
exports.getActiveSessionMdl = function(data) {
    const QRY_TO_EXEC = `
        SELECT s.*, 
               st.sttn_nm_tx, 
               st.addr_tx,
               c.cnntr_typ_cd,
               c.pwr_tx
        FROM sssn_lst_t s
        LEFT JOIN sttn_lst_t st ON s.sttn_id = st.sttn_id
        LEFT JOIN cnntr_lst_t c ON s.cnntr_id = c.cnntr_id
        WHERE s.usr_id = ?
          AND s.sttus_cd = 'active'
          AND s.a_in = 1
        ORDER BY s.i_ts DESC
        LIMIT 1
    `;
    const PARAMS = [data.userId];

    console.log('[getActiveSessionMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

/*****************************************************************************
* Function      : getUserSessionsMdl
* Description   : Get user sessions
* Arguments     : data object with userId, limit, offset, status (optional)
******************************************************************************/
exports.getUserSessionsMdl = function(data) {
    const limit = Number.isFinite(+data.limit) && +data.limit ? Math.max(0, parseInt(data.limit, 10)) : 50;
    const offset = Number.isFinite(+data.offset) && +data.offset ? Math.max(0, parseInt(data.offset, 10)) : 0;
    const PARAMS = [];
    let whereClause = `s.usr_id = ? AND s.a_in = 1`;
    PARAMS.push(data.userId);

    if (data.status) {
        const status = String(data.status);
        whereClause += ` AND s.sttus_cd = ?`;
        PARAMS.push(status);
    }

    const QRY_TO_EXEC = `
        SELECT s.*,
               st.sttn_nm_tx,
               st.addr_tx,
               c.cnntr_typ_cd
        FROM sssn_lst_t s
        LEFT JOIN sttn_lst_t st ON s.sttn_id = st.sttn_id
        LEFT JOIN cnntr_lst_t c ON s.cnntr_id = c.cnntr_id
        WHERE ${whereClause}
        ORDER BY s.i_ts DESC
        LIMIT ${limit} OFFSET ${offset}
    `;

    console.log('[getUserSessionsMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

/*****************************************************************************
* Function      : getMachineScanInfoMdl
* Description   : Resolve a scanned machine to its station + active connectors
* Arguments     : data object with machineId
******************************************************************************/
exports.getMachineScanInfoMdl = function(data) {
    const machineId = parseInt(data.machineId) || 0;
    const QRY_TO_EXEC = `
        SELECT m.mchn_id, m.mchn_nm_tx, m.ocpp_id_tx, m.mchn_typ_cd, m.max_pwr_tx, m.sttus_cd AS mchn_sttus_cd,
               st.sttn_id, st.sttn_nm_tx, st.addr_tx, st.prce_per_kwh_amt, st.sttn_cd,
               c.cnntr_id, c.cnntr_typ_cd, c.cnntr_nm_tx, c.pwr_tx, c.is_avlbl_in
        FROM mchn_lst_t m
        INNER JOIN sttn_lst_t st ON m.sttn_id = st.sttn_id
        LEFT JOIN cnntr_lst_t c ON c.mchn_id = m.mchn_id AND c.a_in = 1
        WHERE m.mchn_id = ? AND m.a_in = 1
        ORDER BY c.cnntr_id ASC
    `;
    const PARAMS = [machineId];

    console.log('[getMachineScanInfoMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

/*****************************************************************************
* Function      : getMachineScanInfoByOcppMdl
* Description   : Same as getMachineScanInfoMdl but resolves by the charger's
*                 OCPP id (so a QR/sticker that encodes the OCPP id or ws-url
*                 still resolves to the station + connectors).
* Arguments     : data object with ocppId
******************************************************************************/
exports.getMachineScanInfoByOcppMdl = function(data) {
    const ocppId = String(data.ocppId || '');
    const QRY_TO_EXEC = `
        SELECT m.mchn_id, m.mchn_nm_tx, m.ocpp_id_tx, m.mchn_typ_cd, m.max_pwr_tx, m.sttus_cd AS mchn_sttus_cd,
               st.sttn_id, st.sttn_nm_tx, st.addr_tx, st.prce_per_kwh_amt, st.sttn_cd,
               c.cnntr_id, c.cnntr_typ_cd, c.cnntr_nm_tx, c.pwr_tx, c.is_avlbl_in
        FROM mchn_lst_t m
        INNER JOIN sttn_lst_t st ON m.sttn_id = st.sttn_id
        LEFT JOIN cnntr_lst_t c ON c.mchn_id = m.mchn_id AND c.a_in = 1
        WHERE m.ocpp_id_tx = ? AND m.a_in = 1
        ORDER BY c.cnntr_id ASC
    `;
    const PARAMS = [ocppId];

    console.log('[getMachineScanInfoByOcppMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

/*****************************************************************************
* Function      : getMachineLiveByIdMdl
* Description   : Machine + connector availability for live pre-charge status
* Arguments     : data object with machineId
******************************************************************************/
exports.getMachineLiveByIdMdl = function(data) {
    const machineId = parseInt(data.machineId) || 0;
    const QRY_TO_EXEC = `
        SELECT m.mchn_id, m.ocpp_id_tx, m.sttus_cd AS mchn_sttus, m.mchn_nm_tx, m.mchn_typ_cd, m.max_pwr_tx,
               (SELECT COUNT(*) FROM cnntr_lst_t c WHERE c.mchn_id = m.mchn_id AND c.a_in = 1 AND c.is_avlbl_in = 1) AS available_connectors,
               (SELECT COUNT(*) FROM cnntr_lst_t c WHERE c.mchn_id = m.mchn_id AND c.a_in = 1) AS total_connectors
        FROM mchn_lst_t m
        WHERE m.mchn_id = ? AND m.a_in = 1
        LIMIT 1`;
    const PARAMS = [machineId];
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

/*****************************************************************************
* Function      : getSessionLiveInfoMdl
* Description   : Live session + machine/connector status for the charging poll
* Arguments     : data object with sessionId, userId
******************************************************************************/
exports.getSessionLiveInfoMdl = function(data) {
    const QRY_TO_EXEC = `
        SELECT s.sssn_id, s.usr_id, s.sttus_cd AS sssn_sttus, s.enrgy_cnsmd_kwh, s.ttl_cst_amt,
               s.prgrss_pct, s.prce_per_kwh_amt,
               m.mchn_id, m.ocpp_id_tx, m.sttus_cd AS mchn_sttus,
               c.cnntr_id, c.is_avlbl_in
        FROM sssn_lst_t s
        INNER JOIN cnntr_lst_t c ON s.cnntr_id = c.cnntr_id
        INNER JOIN mchn_lst_t m ON c.mchn_id = m.mchn_id
        WHERE s.sssn_id = ? AND s.usr_id = ? AND s.a_in = 1
        LIMIT 1`;
    const PARAMS = [parseInt(data.sessionId) || 0, parseInt(data.userId) || 0];
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

/*****************************************************************************
* Function      : updatePaymentStatusMdl
* Description   : Update session payment status
* Arguments     : data object with sessionId, status, transactionId (optional)
******************************************************************************/
exports.updatePaymentStatusMdl = function(data) {
    const PARAMS = [];
    let setClause = `pymnt_sttus_cd = ?`;
    PARAMS.push(String(data.status));

    if (data.transactionId) {
        setClause += `, wllt_trxn_id = ?`;
        PARAMS.push(data.transactionId);
    }

    const QRY_TO_EXEC = `UPDATE sssn_lst_t
        SET ${setClause}
        WHERE sssn_id = ?`;
    PARAMS.push(data.sessionId);

    console.log('[updatePaymentStatusMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

