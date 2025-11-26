/**
 * User Statistics Model
 * Handles user statistics and analytics
 */

const BaseModel = require('./baseModel');

class UserStatisticsModel extends BaseModel {
    constructor() {
        super('user_statistics_t');
    }

    /**
     * Get user statistics
     * @param {Number} userId - User ID
     * @returns {Promise}
     */
    async getUserStatistics(userId) {
        try {
            const result = await this.findOne({ usr_id: userId });
            if (!result) {
                // Create initial statistics
                return await this.create({
                    usr_id: userId,
                    ttl_sssns_nbr: 0,
                    ttl_enrgy_kwh: 0,
                    ttl_spnt_amt: 0,
                    co2_svd_kg: 0,
                    avg_sssn_durn_mnts: 0,
                    avg_sssn_cst_amt: 0
                });
            }
            return result;
        } catch (error) {
            console.error('[UserStatisticsModel] getUserStatistics error:', error);
            throw error;
        }
    }

    /**
     * Get user dashboard stats
     * @param {Number} userId - User ID
     * @returns {Promise}
     */
    async getDashboardStats(userId) {
        try {
            const query = `
                SELECT 
                    COALESCE(COUNT(sssn_id), 0) as total_sessions,
                    COALESCE(SUM(enrgy_cnsmd_kwh), 0) as total_energy,
                    COALESCE(SUM(ttl_cst_amt), 0) as total_spent,
                    COALESCE(SUM(enrgy_cnsmd_kwh * 0.82), 0) as co2_saved,
                    COALESCE(AVG(durn_mnts_nbr), 0) as avg_duration,
                    COALESCE(AVG(ttl_cst_amt), 0) as avg_cost
                FROM charging_sessions_t
                WHERE usr_id = 1
                  AND sttus_cd = 'completed'
                  AND a_in = 1
            `;
            const results = await this.executeQuery(query);
            return results && results.length > 0 ? results[0] : null;
        } catch (error) {
            console.error('[UserStatisticsModel] getDashboardStats error:', error);
            throw error;
        }
    }

    /**
     * Get monthly analytics
     * @param {Number} userId - User ID
     * @param {Number} months - Number of months
     * @returns {Promise}
     */
    async getMonthlyAnalytics(userId, months = 6) {
        try {
            const query = `
                SELECT 
                    DATE_FORMAT(i_ts, '%b') as month,
                    COUNT(sssn_id) as sessions,
                    COALESCE(SUM(enrgy_cnsmd_kwh), 0) as energy,
                    COALESCE(SUM(ttl_cst_amt), 0) as cost
                FROM charging_sessions_t
                WHERE usr_id = ${userId}
                  AND sttus_cd = 'completed'
                  AND i_ts >= DATE_SUB(NOW(), INTERVAL ${months} MONTH)
                  AND a_in = 1
                GROUP BY DATE_FORMAT(i_ts, '%Y-%m')
                ORDER BY i_ts ASC
                LIMIT ${months}
            `;
            return await this.executeQuery(query);
        } catch (error) {
            console.error('[UserStatisticsModel] getMonthlyAnalytics error:', error);
            throw error;
        }
    }

    /**
     * Get weekly activity
     * @param {Number} userId - User ID
     * @returns {Promise}
     */
    async getWeeklyActivity(userId) {
        try {
            const query = `
                SELECT 
                    DAYNAME(i_ts) as day,
                    COUNT(sssn_id) as sessions
                FROM charging_sessions_t
                WHERE usr_id = ${userId}
                  AND sttus_cd = 'completed'
                  AND i_ts >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                  AND a_in = 1
                GROUP BY DAYOFWEEK(i_ts), DAYNAME(i_ts)
                ORDER BY DAYOFWEEK(i_ts)
            `;
            return await this.executeQuery(query);
        } catch (error) {
            console.error('[UserStatisticsModel] getWeeklyActivity error:', error);
            throw error;
        }
    }

    /**
     * Get favorite stations analytics
     * @param {Number} userId - User ID
     * @returns {Promise}
     */
    async getFavoriteStationsAnalytics(userId) {
        try {
            const query = `
                SELECT 
                    s.sttn_nm_tx as name,
                    COUNT(cs.sssn_id) as sessions,
                    ROUND((COUNT(cs.sssn_id) * 100.0 / (
                        SELECT COUNT(*) FROM charging_sessions_t 
                        WHERE usr_id = ${userId} AND sttus_cd = 'completed' AND a_in = 1
                    )), 0) as percentage
                FROM charging_sessions_t cs
                JOIN charging_stations_t s ON cs.sttn_id = s.sttn_id
                WHERE cs.usr_id = ${userId}
                  AND cs.sttus_cd = 'completed'
                  AND cs.a_in = 1
                GROUP BY cs.sttn_id, s.sttn_nm_tx
                ORDER BY sessions DESC
                LIMIT 5
            `;
            return await this.executeQuery(query);
        } catch (error) {
            console.error('[UserStatisticsModel] getFavoriteStationsAnalytics error:', error);
            throw error;
        }
    }
}

module.exports = {
    UserStatistics: new UserStatisticsModel()
};
