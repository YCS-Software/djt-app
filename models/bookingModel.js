/**
 * Station Booking Model
 * Handles charging station booking operations
 */

const BaseModel = require('./baseModel');

class StationBookingModel extends BaseModel {
    constructor() {
        super('bkng_lst_t');
    }

    /**
     * Create booking
     * @param {Object} bookingData - Booking data
     * @returns {Promise}
     */
    async createBooking(bookingData) {
        try {
            const {
                bookingCode,
                userId,
                stationId,
                connectorId,
                bookingDate,
                bookingTime,
                durationMinutes
            } = bookingData;

            const data = {
                bkng_cd: bookingCode,
                usr_id: userId,
                sttn_id: stationId,
                cnntr_id: connectorId || null,
                bkng_dte: bookingDate,
                bkng_tm: bookingTime,
                durn_mnts_nbr: durationMinutes,
                sttus_cd: 'confirmed',
                a_in: 1
            };

            return await this.create(data);
        } catch (error) {
            console.error('[StationBookingModel] createBooking error:', error);
            throw error;
        }
    }

    /**
     * Get user bookings
     * @param {Number} userId - User ID
     * @param {Object} options - Query options
     * @returns {Promise}
     */
    async getUserBookings(userId, options = {}) {
        try {
            const limit = options.limit || 50;
            const offset = options.offset || 0;
            const status = options.status || null;

            let whereClause = `b.usr_id = ${userId} AND b.a_in = 1`;
            if (status) {
                whereClause += ` AND b.sttus_cd = '${status}'`;
            }

            const query = `
                SELECT b.*,
                       s.sttn_nm_tx,
                       s.addr_tx,
                       s.prce_per_kwh_amt,
                       c.cnntr_typ_cd
                FROM ${this.tableName} b
                LEFT JOIN sttn_lst_t s ON b.sttn_id = s.sttn_id
                LEFT JOIN cnntr_lst_t c ON b.cnntr_id = c.cnntr_id
                WHERE ${whereClause}
                ORDER BY b.bkng_dte DESC, b.bkng_tm DESC
                LIMIT ${limit} OFFSET ${offset}
            `;
            return await this.executeQuery(query);
        } catch (error) {
            console.error('[StationBookingModel] getUserBookings error:', error);
            throw error;
        }
    }

    /**
     * Get upcoming bookings
     * @param {Number} userId - User ID
     * @returns {Promise}
     */
    async getUpcomingBookings(userId) {
        try {
            const query = `
                SELECT b.*,
                       s.sttn_nm_tx,
                       s.addr_tx
                FROM ${this.tableName} b
                LEFT JOIN sttn_lst_t s ON b.sttn_id = s.sttn_id
                WHERE b.usr_id = ${userId}
                  AND b.sttus_cd = 'confirmed'
                  AND b.bkng_dte >= CURDATE()
                  AND b.a_in = 1
                ORDER BY b.bkng_dte ASC, b.bkng_tm ASC
                LIMIT 10
            `;
            return await this.executeQuery(query);
        } catch (error) {
            console.error('[StationBookingModel] getUpcomingBookings error:', error);
            throw error;
        }
    }

    /**
     * Cancel booking
     * @param {Number} bookingId - Booking ID
     * @param {String} reason - Cancellation reason
     * @returns {Promise}
     */
    async cancelBooking(bookingId, reason = null) {
        try {
            const query = `
                UPDATE ${this.tableName}
                SET sttus_cd = 'cancelled',
                    cncltn_rsn_tx = ${reason ? `'${reason}'` : 'NULL'},
                    cnclld_ts = NOW()
                WHERE bkng_id = ${bookingId}
            `;
            return await this.executeQuery(query);
        } catch (error) {
            console.error('[StationBookingModel] cancelBooking error:', error);
            throw error;
        }
    }

    /**
     * Complete booking
     * @param {Number} bookingId - Booking ID
     * @returns {Promise}
     */
    async completeBooking(bookingId) {
        try {
            return await this.update(
                { sttus_cd: 'completed' },
                { bkng_id: bookingId }
            );
        } catch (error) {
            console.error('[StationBookingModel] completeBooking error:', error);
            throw error;
        }
    }

    /**
     * Check slot availability
     * @param {Number} stationId - Station ID
     * @param {String} bookingDate - Booking date (YYYY-MM-DD)
     * @param {String} bookingTime - Booking time (HH:MM)
     * @returns {Promise}
     */
    async checkSlotAvailability(stationId, bookingDate, bookingTime) {
        try {
            const query = `
                SELECT COUNT(*) as count
                FROM ${this.tableName}
                WHERE sttn_id = ${stationId}
                  AND bkng_dte = '${bookingDate}'
                  AND bkng_tm = '${bookingTime}'
                  AND sttus_cd = 'confirmed'
                  AND a_in = 1
            `;
            const results = await this.executeQuery(query);
            return results && results.length > 0 ? results[0].count : 0;
        } catch (error) {
            console.error('[StationBookingModel] checkSlotAvailability error:', error);
            throw error;
        }
    }

    /**
     * Get booking by code
     * @param {String} bookingCode - Booking code
     * @returns {Promise}
     */
    async getByCode(bookingCode) {
        try {
            return await this.findOne({ bkng_cd: bookingCode });
        } catch (error) {
            console.error('[StationBookingModel] getByCode error:', error);
            throw error;
        }
    }
}

module.exports = {
    StationBooking: new StationBookingModel()
};
