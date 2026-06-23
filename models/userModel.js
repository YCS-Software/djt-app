/**
 * User Model
 * Handles user-related database operations
 */

const BaseModel = require('./baseModel');

class UserModel extends BaseModel {
    constructor() {
        super('usr_lst_t'); // Table name
    }

    /**
     * Find user by phone number
     * @param {String} phoneNumber - User's phone number
     * @returns {Promise}
     */
    async findByPhoneNumber(phoneNumber) {
        try {
            return await this.findOne({ phn_nmbr_tx: phoneNumber });
        } catch (error) {
            console.error('[UserModel] findByPhoneNumber error:', error);
            throw error;
        }
    }

    /**
     * Alias for findByPhoneNumber
     * @param {String} phone - User's phone number
     * @returns {Promise}
     */
    async findByPhone(phone) {
        return this.findByPhoneNumber(phone);
    }

    /**
     * Find user by email
     * @param {String} email - User's email
     * @returns {Promise}
     */
    async findByEmail(email) {
        try {
            return await this.findOne({ eml_tx: email });
        } catch (error) {
            console.error('[UserModel] findByEmail error:', error);
            throw error;
        }
    }

    /**
     * Create a new user
     * @param {Object} userData - User data
     * @returns {Promise}
     */
    async createUser(userData) {
        try {
            const data = {
                phn_nmbr_tx: userData.phoneNumber,
                eml_tx: userData.email || null,
                nm_tx: userData.name || null,
                a_in: 1, // Active indicator
                i_ts: new Date(), // Insert timestamp
              
            };
            
            return await this.create(data);
        } catch (error) {
            console.error('[UserModel] createUser error:', error);
            throw error;
        }
    }

    /**
     * Update user profile
     * @param {Number} userId - User ID
     * @param {Object} updates - Fields to update
     * @returns {Promise}
     */
    async updateProfile(userId, updates) {
        try {
            const data = {
                ...updates,
                u_ts: new Date(), // Update timestamp
                updte_usr_id: userId
            };
            
            return await this.update(data, { usr_id: userId });
        } catch (error) {
            console.error('[UserModel] updateProfile error:', error);
            throw error;
        }
    }

    /**
     * Deactivate user (soft delete)
     * @param {Number} userId - User ID
     * @returns {Promise}
     */
    async deactivate(userId) {
        try {
            return await this.update(
                { 
                    a_in: 0, 
                    d_ts: new Date() 
                },
                { usr_id: userId }
            );
        } catch (error) {
            console.error('[UserModel] deactivate error:', error);
            throw error;
        }
    }

    /**
     * Get active users
     * @param {Object} options - Query options
     * @returns {Promise}
     */
    async getActiveUsers(options = {}) {
        try {
            return await this.findAll({
                where: { a_in: 1 },
                ...options
            });
        } catch (error) {
            console.error('[UserModel] getActiveUsers error:', error);
            throw error;
        }
    }

    /**
     * Search users by name or phone
     * @param {String} searchTerm - Search term
     * @returns {Promise}
     */
    async searchUsers(searchTerm) {
        try {
            const query = `
                SELECT * FROM ${this.tableName}
                WHERE a_in = 1 
                AND (nm_tx LIKE '%${searchTerm}%' OR phn_nmbr_tx LIKE '%${searchTerm}%')
                ORDER BY nm_tx
            `;
            return await this.executeQuery(query);
        } catch (error) {
            console.error('[UserModel] searchUsers error:', error);
            throw error;
        }
    }
}

module.exports = new UserModel();
