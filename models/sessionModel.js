/**
 * Charging Session Model
 * Handles charging session operations
 */

const BaseModel = require('./baseModel');

class ChargingSessionModel extends BaseModel {
    constructor() {
        super('charging_sessions_t');
    }

    /**
     * Create charging session
     * @param {Object} sessionData - Session data
     * @returns {Promise}
     */
    async createSession(sessionData) {
        try {
            const {
                sessionCode,
                userId,
                stationId,
                connectorId,
                pricePerKwh,
                qrCode
            } = sessionData;

            const data = {
                sssn_cd: sessionCode,
                usr_id: userId,
                sttn_id: stationId,
                cnntr_id: connectorId,
                prce_per_kwh_amt: pricePerKwh,
                qr_cd_tx: qrCode || null,
                sttus_cd: 'initiated',
                pymnt_sttus_cd: 'pending',
                a_in: 1
            };

            return await this.create(data);
        } catch (error) {
            console.error('[ChargingSessionModel] createSession error:', error);
            throw error;
        }
    }

    /**
     * Start charging session
     * @param {Number} sessionId - Session ID
     * @returns {Promise}
     */
    async startSession(sessionId) {
        try {
            const query = `
                UPDATE ${this.tableName}
                SET sttus_cd = 'active',
                    strt_ts = NOW()
                WHERE sssn_id = ${sessionId}
            `;
            return await this.executeQuery(query);
        } catch (error) {
            console.error('[ChargingSessionModel] startSession error:', error);
            throw error;
        }
    }

    /**
     * Stop charging session
     * @param {Number} sessionId - Session ID
     * @param {Number} energyConsumed - Energy consumed in kWh
     * @param {Number} totalCost - Total cost
     * @returns {Promise}
     */
    async stopSession(sessionId, energyConsumed, totalCost) {
        try {
            const query = `
                UPDATE ${this.tableName}
                SET sttus_cd = 'completed',
                    end_ts = NOW(),
                    durn_mnts_nbr = TIMESTAMPDIFF(MINUTE, strt_ts, NOW()),
                    enrgy_cnsmd_kwh = ${energyConsumed},
                    ttl_cst_amt = ${totalCost},
                    prgrss_pct = 100
                WHERE sssn_id = ${sessionId}
            `;
            return await this.executeQuery(query);
        } catch (error) {
            console.error('[ChargingSessionModel] stopSession error:', error);
            throw error;
        }
    }

    /**
     * Update session progress
     * @param {Number} sessionId - Session ID
     * @param {Object} progressData - Progress data
     * @returns {Promise}
     */
    async updateProgress(sessionId, progressData) {
        try {
            const {
                progress,
                energyConsumed,
                currentCost
            } = progressData;

            const query = `
                UPDATE ${this.tableName}
                SET prgrss_pct = ${progress},
                    enrgy_cnsmd_kwh = ${energyConsumed},
                    ttl_cst_amt = ${currentCost}
                WHERE sssn_id = ${sessionId}
            `;
            return await this.executeQuery(query);
        } catch (error) {
            console.error('[ChargingSessionModel] updateProgress error:', error);
            throw error;
        }
    }

    /**
     * Get user sessions
     * @param {Number} userId - User ID
     * @param {Object} options - Query options
     * @returns {Promise}
     */
    async getUserSessions(userId, options = {}) {
        try {
            const limit = options.limit || 50;
            const offset = options.offset || 0;
            const status = options.status || null;

            let whereClause = `s.usr_id = ${userId} AND s.a_in = 1`;
            if (status) {
                whereClause += ` AND s.sttus_cd = '${status}'`;
            }

            const query = `
                SELECT s.*, 
                       st.sttn_nm_tx, 
                       st.addr_tx,
                       c.cnntr_typ_cd
                FROM ${this.tableName} s
                LEFT JOIN charging_stations_t st ON s.sttn_id = st.sttn_id
                LEFT JOIN station_connectors_t c ON s.cnntr_id = c.cnntr_id
                WHERE ${whereClause}
                ORDER BY s.i_ts DESC
                LIMIT ${limit} OFFSET ${offset}
            `;
            return await this.executeQuery(query);
        } catch (error) {
            console.error('[ChargingSessionModel] getUserSessions error:', error);
            throw error;
        }
    }

    /**
     * Get session by code
     * @param {String} sessionCode - Session code
     * @returns {Promise}
     */
    async getByCode(sessionCode) {
        try {
            return await this.findOne({ sssn_cd: sessionCode });
        } catch (error) {
            console.error('[ChargingSessionModel] getByCode error:', error);
            throw error;
        }
    }

    /**
     * Get active session for user
     * @param {Number} userId - User ID
     * @returns {Promise}
     */
    async getActiveSession(userId) {
        try {
            const query = `
                SELECT s.*, 
                       st.sttn_nm_tx, 
                       st.addr_tx,
                       c.cnntr_typ_cd,
                       c.pwr_tx
                FROM ${this.tableName} s
                LEFT JOIN charging_stations_t st ON s.sttn_id = st.sttn_id
                LEFT JOIN station_connectors_t c ON s.cnntr_id = c.cnntr_id
                WHERE s.usr_id = ${userId} 
                  AND s.sttus_cd = 'active'
                  AND s.a_in = 1
                ORDER BY s.i_ts DESC
                LIMIT 1
            `;
            const results = await this.executeQuery(query);
            return results && results.length > 0 ? results[0] : null;
        } catch (error) {
            console.error('[ChargingSessionModel] getActiveSession error:', error);
            throw error;
        }
    }

    /**
     * Update payment status
     * @param {Number} sessionId - Session ID
     * @param {String} status - Payment status
     * @param {Number} transactionId - Wallet transaction ID
     * @returns {Promise}
     */
    async updatePaymentStatus(sessionId, status, transactionId = null) {
        try {
            const data = { pymnt_sttus_cd: status };
            if (transactionId) {
                data.wllt_trxn_id = transactionId;
            }
            return await this.update(data, { sssn_id: sessionId });
        } catch (error) {
            console.error('[ChargingSessionModel] updatePaymentStatus error:', error);
            throw error;
        }
    }
}

class ChargingSessionLogModel extends BaseModel {
    constructor() {
        super('charging_session_logs_t');
    }

    /**
     * Create session log
     * @param {Object} logData - Log data
     * @returns {Promise}
     */
    async createLog(logData) {
        try {
            const {
                sessionId,
                progress,
                energyConsumed,
                currentCost,
                batteryLevel
            } = logData;

            const data = {
                sssn_id: sessionId,
                prgrss_pct: progress,
                enrgy_cnsmd_kwh: energyConsumed,
                crnt_cst_amt: currentCost,
                bttry_lvl_pct: batteryLevel || null
            };

            return await this.create(data);
        } catch (error) {
            console.error('[ChargingSessionLogModel] createLog error:', error);
            throw error;
        }
    }

    /**
     * Get session logs
     * @param {Number} sessionId - Session ID
     * @param {Number} limit - Limit results
     * @returns {Promise}
     */
    async getSessionLogs(sessionId, limit = 100) {
        try {
            const query = `
                SELECT * FROM ${this.tableName}
                WHERE sssn_id = ${sessionId}
                ORDER BY log_ts DESC
                LIMIT ${limit}
            `;
            return await this.executeQuery(query);
        } catch (error) {
            console.error('[ChargingSessionLogModel] getSessionLogs error:', error);
            throw error;
        }
    }
}

module.exports = {
    ChargingSession: new ChargingSessionModel(),
    ChargingSessionLog: new ChargingSessionLogModel()
};
