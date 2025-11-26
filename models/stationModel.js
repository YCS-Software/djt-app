/**
 * Charging Station Model
 * Handles charging station operations
 */

const BaseModel = require('./baseModel');

class ChargingStationModel extends BaseModel {
    constructor() {
        super('charging_stations_t');
    }

    /**
     * Get nearby stations
     * @param {Number} latitude - User latitude
     * @param {Number} longitude - User longitude
     * @param {Number} radius - Search radius in km
     * @returns {Promise}
     */
    async getNearbyStations(latitude, longitude, radius = 50) {
        try {
            const query = `
                SELECT *,
                    (6371 * acos(
                        cos(radians(${latitude})) * 
                        cos(radians(ltde_nbr)) * 
                        cos(radians(lngtde_nbr) - radians(${longitude})) + 
                        sin(radians(${latitude})) * 
                        sin(radians(ltde_nbr))
                    )) AS distance
                FROM ${this.tableName}
                WHERE a_in = 1
                HAVING distance < ${radius}
                ORDER BY distance
                LIMIT 50
            `;
            return await this.executeQuery(query);
        } catch (error) {
            console.error('[ChargingStationModel] getNearbyStations error:', error);
            throw error;
        }
    }

    /**
     * Get station by code
     * @param {String} stationCode - Station code
     * @returns {Promise}
     */
    async getByCode(stationCode) {
        try {
            return await this.findOne({ sttn_cd: stationCode });
        } catch (error) {
            console.error('[ChargingStationModel] getByCode error:', error);
            throw error;
        }
    }

    /**
     * Get all active stations
     * @param {Object} options - Query options
     * @returns {Promise}
     */
    async getActiveStations(options = {}) {
        try {
            return await this.findAll({
                where: { a_in: 1 },
                orderBy: 'sttn_nm_tx ASC',
                ...options
            });
        } catch (error) {
            console.error('[ChargingStationModel] getActiveStations error:', error);
            throw error;
        }
    }

    /**
     * Search stations
     * @param {String} searchTerm - Search term
     * @returns {Promise}
     */
    async searchStations(searchTerm) {
        try {
            const query = `
                SELECT * FROM ${this.tableName}
                WHERE a_in = 1 
                AND (sttn_nm_tx LIKE '%${searchTerm}%' 
                     OR addr_tx LIKE '%${searchTerm}%'
                     OR cty_tx LIKE '%${searchTerm}%')
                ORDER BY sttn_nm_tx
                LIMIT 20
            `;
            return await this.executeQuery(query);
        } catch (error) {
            console.error('[ChargingStationModel] searchStations error:', error);
            throw error;
        }
    }

    /**
     * Update station rating
     * @param {Number} stationId - Station ID
     * @param {Number} newRating - New rating value
     * @returns {Promise}
     */
    async updateRating(stationId, newRating) {
        try {
            const query = `
                UPDATE ${this.tableName}
                SET ttl_rtngs_nbr = ttl_rtngs_nbr + 1,
                    rtng_nbr = ((rtng_nbr * ttl_rtngs_nbr) + ${newRating}) / (ttl_rtngs_nbr + 1)
                WHERE sttn_id = ${stationId}
            `;
            return await this.executeQuery(query);
        } catch (error) {
            console.error('[ChargingStationModel] updateRating error:', error);
            throw error;
        }
    }
}

class StationConnectorModel extends BaseModel {
    constructor() {
        super('station_connectors_t');
    }

    /**
     * Get station connectors
     * @param {Number} stationId - Station ID
     * @returns {Promise}
     */
    async getStationConnectors(stationId) {
        try {
            return await this.findAll({
                where: { sttn_id: stationId, a_in: 1 }
            });
        } catch (error) {
            console.error('[StationConnectorModel] getStationConnectors error:', error);
            throw error;
        }
    }

    /**
     * Get available connector
     * @param {Number} stationId - Station ID
     * @param {String} connectorType - Connector type
     * @returns {Promise}
     */
    async getAvailableConnector(stationId, connectorType = null) {
        try {
            const where = {
                sttn_id: stationId,
                is_avlbl_in: 1,
                a_in: 1
            };
            if (connectorType) {
                where.cnntr_typ_cd = connectorType;
            }
            return await this.findOne(where);
        } catch (error) {
            console.error('[StationConnectorModel] getAvailableConnector error:', error);
            throw error;
        }
    }
}

class UserFavoriteStationModel extends BaseModel {
    constructor() {
        super('user_favorite_stations_t');
    }

    /**
     * Add favorite station
     * @param {Number} userId - User ID
     * @param {Number} stationId - Station ID
     * @returns {Promise}
     */
    async addFavorite(userId, stationId) {
        try {
            const data = {
                usr_id: userId,
                sttn_id: stationId,
                a_in: 1
            };
            return await this.create(data);
        } catch (error) {
            console.error('[UserFavoriteStationModel] addFavorite error:', error);
            throw error;
        }
    }

    /**
     * Remove favorite station
     * @param {Number} userId - User ID
     * @param {Number} stationId - Station ID
     * @returns {Promise}
     */
    async removeFavorite(userId, stationId) {
        try {
            return await this.delete({
                usr_id: userId,
                sttn_id: stationId
            });
        } catch (error) {
            console.error('[UserFavoriteStationModel] removeFavorite error:', error);
            throw error;
        }
    }

    /**
     * Get user favorites
     * @param {Number} userId - User ID
     * @returns {Promise}
     */
    async getUserFavorites(userId) {
        try {
            const query = `
                SELECT s.*, f.i_ts as favorited_at
                FROM ${this.tableName} f
                JOIN charging_stations_t s ON f.sttn_id = s.sttn_id
                WHERE f.usr_id = ${userId} AND f.a_in = 1 AND s.a_in = 1
                ORDER BY f.i_ts DESC
            `;
            return await this.executeQuery(query);
        } catch (error) {
            console.error('[UserFavoriteStationModel] getUserFavorites error:', error);
            throw error;
        }
    }

    /**
     * Check if favorite
     * @param {Number} userId - User ID
     * @param {Number} stationId - Station ID
     * @returns {Promise}
     */
    async isFavorite(userId, stationId) {
        try {
            const result = await this.findOne({
                usr_id: userId,
                sttn_id: stationId,
                a_in: 1
            });
            return result !== null;
        } catch (error) {
            console.error('[UserFavoriteStationModel] isFavorite error:', error);
            throw error;
        }
    }
}

module.exports = {
    ChargingStation: new ChargingStationModel(),
    StationConnector: new StationConnectorModel(),
    UserFavoriteStation: new UserFavoriteStationModel()
};
