/**
 * Authentication Model
 * Handles authentication-related database operations
 */

const BaseModel = require('./baseModel');

class AuthModel extends BaseModel {
    constructor() {
        super('auth_otp_t'); // OTP table name
    }

    /**
     * Store OTP for phone number
     * @param {String} phoneNumber - User's phone number
     * @param {String} otp - Generated OTP
     * @param {Number} expiryMinutes - OTP expiry time in minutes
     * @returns {Promise}
     */
    async storeOTP(phoneNumber, otp, expiryMinutes = 5) {
        try {
            const expiryTime = new Date(Date.now() + expiryMinutes * 60000);
            
            const data = {
                phn_nmbr_tx: phoneNumber,
                otp_tx: otp,
                expry_ts: expiryTime,
                attmpts_nbr: 0,
                is_vrfd_in: 0,
                a_in: 1,
                i_ts: new Date()
            };
            
            return await this.create(data);
        } catch (error) {
            console.error('[AuthModel] storeOTP error:', error);
            throw error;
        }
    }

    /**
     * Get valid OTP for phone number
     * @param {String} phoneNumber - User's phone number
     * @returns {Promise}
     */
    async getValidOTP(phoneNumber) {
        try {
            const query = `
                SELECT * FROM ${this.tableName}
                WHERE phn_nmbr_tx = '${phoneNumber}'
                AND is_vrfd_in = 0
                AND a_in = 1
                AND expry_ts > NOW()
                ORDER BY i_ts DESC
                LIMIT 1
            `;
            
            const results = await this.executeQuery(query);
            return results && results.length > 0 ? results[0] : null;
        } catch (error) {
            console.error('[AuthModel] getValidOTP error:', error);
            throw error;
        }
    }

    /**
     * Verify OTP
     * @param {String} phoneNumber - User's phone number
     * @param {String} otp - OTP to verify
     * @returns {Promise}
     */
    async verifyOTP(phoneNumber, otp) {
        try {
            const otpRecord = await this.getValidOTP(phoneNumber);
            
            if (!otpRecord) {
                return { success: false, message: 'OTP expired or not found' };
            }

            // Increment attempt counter
            await this.update(
                { attmpts_nbr: otpRecord.attmpts_nbr + 1 },
                { otp_id: otpRecord.otp_id }
            );

            // Check if OTP matches
            if (otpRecord.otp_tx === otp) {
                // Mark as verified
                await this.update(
                    { is_vrfd_in: 1, vrfd_ts: new Date() },
                    { otp_id: otpRecord.otp_id }
                );
                return { success: true, message: 'OTP verified successfully' };
            } else {
                // Check max attempts
                if (otpRecord.attmpts_nbr >= 2) { // 3 attempts total
                    await this.update(
                        { a_in: 0 },
                        { otp_id: otpRecord.otp_id }
                    );
                    return { success: false, message: 'Maximum attempts reached. Please request new OTP' };
                }
                return { success: false, message: 'Invalid OTP' };
            }
        } catch (error) {
            console.error('[AuthModel] verifyOTP error:', error);
            throw error;
        }
    }

    /**
     * Invalidate all OTPs for phone number
     * @param {String} phoneNumber - User's phone number
     * @returns {Promise}
     */
    async invalidateOTPs(phoneNumber) {
        try {
            return await this.update(
                { a_in: 0 },
                { phn_nmbr_tx: phoneNumber, is_vrfd_in: 0 }
            );
        } catch (error) {
            console.error('[AuthModel] invalidateOTPs error:', error);
            throw error;
        }
    }

    /**
     * Clean expired OTPs
     * @returns {Promise}
     */
    async cleanExpiredOTPs() {
        try {
            const query = `
                UPDATE ${this.tableName}
                SET a_in = 0
                WHERE expry_ts < NOW()
                AND is_vrfd_in = 0
                AND a_in = 1
            `;
            return await this.executeQuery(query);
        } catch (error) {
            console.error('[AuthModel] cleanExpiredOTPs error:', error);
            throw error;
        }
    }

    /**
     * Get OTP history for phone number
     * @param {String} phoneNumber - User's phone number
     * @param {Number} limit - Number of records to fetch
     * @returns {Promise}
     */
    async getOTPHistory(phoneNumber, limit = 10) {
        try {
            const query = `
                SELECT * FROM ${this.tableName}
                WHERE phn_nmbr_tx = '${phoneNumber}'
                ORDER BY i_ts DESC
                LIMIT ${limit}
            `;
            return await this.executeQuery(query);
        } catch (error) {
            console.error('[AuthModel] getOTPHistory error:', error);
            throw error;
        }
    }
}

module.exports = new AuthModel();
