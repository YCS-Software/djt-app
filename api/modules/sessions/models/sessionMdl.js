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
    const qrCode = data.qrCode ? `'${String(data.qrCode).replace(/'/g, "''")}'` : 'NULL';
    const QRY_TO_EXEC = `INSERT INTO charging_sessions_t 
        (sssn_cd, usr_id, sttn_id, cnntr_id, prce_per_kwh_amt, qr_cd_tx, sttus_cd, pymnt_sttus_cd, a_in) 
        VALUES 
        ('${String(data.sessionCode).replace(/'/g, "''")}', ${data.userId}, ${data.stationId}, ${data.connectorId}, 
         ${data.pricePerKwh}, ${qrCode}, 'initiated', 'pending', 1)`;
    
    console.log('[createSessionMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};

/*****************************************************************************
* Function      : startSessionMdl
* Description   : Start charging session (update status to active)
* Arguments     : data object with sessionId
******************************************************************************/
exports.startSessionMdl = function(data) {
    const QRY_TO_EXEC = `UPDATE charging_sessions_t 
        SET sttus_cd = 'active', 
            strt_ts = NOW() 
        WHERE sssn_id = ${data.sessionId}`;
    
    console.log('[startSessionMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};

/*****************************************************************************
* Function      : stopSessionMdl
* Description   : Stop charging session (update status to completed)
* Arguments     : data object with sessionId, energyConsumed, totalCost
******************************************************************************/
exports.stopSessionMdl = function(data) {
    const QRY_TO_EXEC = `UPDATE charging_sessions_t 
        SET sttus_cd = 'completed', 
            end_ts = NOW(), 
            durn_mnts_nbr = TIMESTAMPDIFF(MINUTE, strt_ts, NOW()), 
            enrgy_cnsmd_kwh = ${data.energyConsumed}, 
            ttl_cst_amt = ${data.totalCost}, 
            prgrss_pct = 100 
        WHERE sssn_id = ${data.sessionId}`;
    
    console.log('[stopSessionMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};

/*****************************************************************************
* Function      : updateProgressMdl
* Description   : Update session progress
* Arguments     : data object with sessionId, progress, energyConsumed, currentCost
******************************************************************************/
exports.updateProgressMdl = function(data) {
    const QRY_TO_EXEC = `UPDATE charging_sessions_t 
        SET prgrss_pct = ${data.progress}, 
            enrgy_cnsmd_kwh = ${data.energyConsumed}, 
            ttl_cst_amt = ${data.currentCost} 
        WHERE sssn_id = ${data.sessionId}`;
    
    console.log('[updateProgressMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};

/*****************************************************************************
* Function      : getSessionByIdMdl
* Description   : Get session by ID
* Arguments     : data object with sessionId
******************************************************************************/
exports.getSessionByIdMdl = function(data) {
    const QRY_TO_EXEC = `SELECT * FROM charging_sessions_t 
        WHERE sssn_id = ${data.sessionId} 
        AND a_in = 1 
        LIMIT 1`;
    
    console.log('[getSessionByIdMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};

/*****************************************************************************
* Function      : getSessionByCodeMdl
* Description   : Get session by code
* Arguments     : data object with sessionCode
******************************************************************************/
exports.getSessionByCodeMdl = function(data) {
    const sessionCode = String(data.sessionCode).replace(/'/g, "''");
    const QRY_TO_EXEC = `SELECT * FROM charging_sessions_t 
        WHERE sssn_cd = '${sessionCode}' 
        AND a_in = 1 
        LIMIT 1`;
    
    console.log('[getSessionByCodeMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
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
        FROM charging_sessions_t s
        LEFT JOIN charging_stations_t st ON s.sttn_id = st.sttn_id
        LEFT JOIN station_connectors_t c ON s.cnntr_id = c.cnntr_id
        WHERE s.usr_id = ${data.userId} 
          AND s.sttus_cd = 'active'
          AND s.a_in = 1
        ORDER BY s.i_ts DESC
        LIMIT 1
    `;
    
    console.log('[getActiveSessionMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};

/*****************************************************************************
* Function      : getUserSessionsMdl
* Description   : Get user sessions
* Arguments     : data object with userId, limit, offset, status (optional)
******************************************************************************/
exports.getUserSessionsMdl = function(data) {
    const limit = data.limit || 50;
    const offset = data.offset || 0;
    let whereClause = `s.usr_id = ${data.userId} AND s.a_in = 1`;
    
    if (data.status) {
        const status = String(data.status).replace(/'/g, "''");
        whereClause += ` AND s.sttus_cd = '${status}'`;
    }
    
    const QRY_TO_EXEC = `
        SELECT s.*, 
               st.sttn_nm_tx, 
               st.addr_tx,
               c.cnntr_typ_cd
        FROM charging_sessions_t s
        LEFT JOIN charging_stations_t st ON s.sttn_id = st.sttn_id
        LEFT JOIN station_connectors_t c ON s.cnntr_id = c.cnntr_id
        WHERE ${whereClause}
        ORDER BY s.i_ts DESC
        LIMIT ${limit} OFFSET ${offset}
    `;
    
    console.log('[getUserSessionsMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};

/*****************************************************************************
* Function      : updatePaymentStatusMdl
* Description   : Update session payment status
* Arguments     : data object with sessionId, status, transactionId (optional)
******************************************************************************/
exports.updatePaymentStatusMdl = function(data) {
    let setClause = `pymnt_sttus_cd = '${String(data.status).replace(/'/g, "''")}'`;
    
    if (data.transactionId) {
        setClause += `, wllt_trxn_id = ${data.transactionId}`;
    }
    
    const QRY_TO_EXEC = `UPDATE charging_sessions_t 
        SET ${setClause} 
        WHERE sssn_id = ${data.sessionId}`;
    
    console.log('[updatePaymentStatusMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};

