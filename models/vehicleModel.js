/**
 * User Vehicle Model
 * Handles user vehicle operations
 */

const BaseModel = require('./baseModel');

class UserVehicleModel extends BaseModel {
    constructor() {
        super('user_vehicles_t');
    }

    /**
     * Add vehicle
     * @param {Object} vehicleData - Vehicle data
     * @returns {Promise}
     */
    async addVehicle(vehicleData) {
        try {
            const {
                userId,
                vehicleName,
                make,
                model,
                year,
                registrationNumber,
                batteryCapacity,
                connectorType,
                isDefault = false
            } = vehicleData;

            const data = {
                usr_id: userId,
                vhcl_nm_tx: vehicleName || null,
                mke_tx: make || null,
                mdl_tx: model || null,
                yr_nbr: year || null,
                rg_nbr_tx: registrationNumber || null,
                bttry_cpcty_kwh: batteryCapacity || null,
                cnntr_typ_cd: connectorType || null,
                is_dflt_in: isDefault ? 1 : 0,
                a_in: 1
            };

            return await this.create(data);
        } catch (error) {
            console.error('[UserVehicleModel] addVehicle error:', error);
            throw error;
        }
    }

    /**
     * Get user vehicles
     * @param {Number} userId - User ID
     * @returns {Promise}
     */
    async getUserVehicles(userId) {
        try {
            return await this.findAll({
                where: { usr_id: userId, a_in: 1 },
                orderBy: 'is_dflt_in DESC, i_ts DESC'
            });
        } catch (error) {
            console.error('[UserVehicleModel] getUserVehicles error:', error);
            throw error;
        }
    }

    /**
     * Get default vehicle
     * @param {Number} userId - User ID
     * @returns {Promise}
     */
    async getDefaultVehicle(userId) {
        try {
            return await this.findOne({
                usr_id: userId,
                is_dflt_in: 1,
                a_in: 1
            });
        } catch (error) {
            console.error('[UserVehicleModel] getDefaultVehicle error:', error);
            throw error;
        }
    }

    /**
     * Set default vehicle
     * @param {Number} userId - User ID
     * @param {Number} vehicleId - Vehicle ID
     * @returns {Promise}
     */
    async setDefaultVehicle(userId, vehicleId) {
        try {
            // Remove default from all user vehicles
            await this.executeQuery(`
                UPDATE ${this.tableName}
                SET is_dflt_in = 0
                WHERE usr_id = ${userId}
            `);

            // Set new default
            return await this.update(
                { is_dflt_in: 1 },
                { vhcl_id: vehicleId, usr_id: userId }
            );
        } catch (error) {
            console.error('[UserVehicleModel] setDefaultVehicle error:', error);
            throw error;
        }
    }

    /**
     * Update vehicle
     * @param {Number} vehicleId - Vehicle ID
     * @param {Object} updates - Update data
     * @returns {Promise}
     */
    async updateVehicle(vehicleId, updates) {
        try {
            return await this.update(updates, { vhcl_id: vehicleId });
        } catch (error) {
            console.error('[UserVehicleModel] updateVehicle error:', error);
            throw error;
        }
    }

    /**
     * Delete vehicle
     * @param {Number} vehicleId - Vehicle ID
     * @returns {Promise}
     */
    async deleteVehicle(vehicleId) {
        try {
            return await this.update(
                { a_in: 0 },
                { vhcl_id: vehicleId }
            );
        } catch (error) {
            console.error('[UserVehicleModel] deleteVehicle error:', error);
            throw error;
        }
    }
}

module.exports = {
    UserVehicle: new UserVehicleModel()
};
