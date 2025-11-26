/**
 * Wallet Model
 * Handles wallet and transaction operations
 */

const BaseModel = require('./baseModel');

class WalletModel extends BaseModel {
    constructor() {
        super('wallet_t');
    }

    /**
     * Get user wallet
     * @param {Number} userId - User ID
     * @returns {Promise}
     */
    async getUserWallet(userId) {
        try {
            const query = `SELECT * FROM ${this.tableName} WHERE usr_id = ${userId} AND a_in = 1`;
            const results = await this.executeQuery(query);
            return results && results.length > 0 ? results[0] : null;
        } catch (error) {
            console.error('[WalletModel] getUserWallet error:', error);
            throw error;
        }
    }

    /**
     * Create wallet for user
     * @param {Number} userId - User ID
     * @returns {Promise}
     */
    async createWallet(userId) {
        try {
            const data = {
                usr_id: userId,
                blnce_amt: 0.00,
                a_in: 1
            };
            return await this.create(data);
        } catch (error) {
            console.error('[WalletModel] createWallet error:', error);
            throw error;
        }
    }

    /**
     * Add money to wallet
     * @param {Number} walletId - Wallet ID
     * @param {Number} amount - Amount to add
     * @returns {Promise}
     */
    async addMoney(walletId, amount) {
        try {
            const query = `
                UPDATE ${this.tableName}
                SET blnce_amt = blnce_amt + ${amount}
                WHERE wllt_id = ${walletId}
            `;
            return await this.executeQuery(query);
        } catch (error) {
            console.error('[WalletModel] addMoney error:', error);
            throw error;
        }
    }

    /**
     * Deduct money from wallet
     * @param {Number} walletId - Wallet ID
     * @param {Number} amount - Amount to deduct
     * @returns {Promise}
     */
    async deductMoney(walletId, amount) {
        try {
            const query = `
                UPDATE ${this.tableName}
                SET blnce_amt = blnce_amt - ${amount}
                WHERE wllt_id = ${walletId} AND blnce_amt >= ${amount}
            `;
            return await this.executeQuery(query);
        } catch (error) {
            console.error('[WalletModel] deductMoney error:', error);
            throw error;
        }
    }

    /**
     * Get wallet balance
     * @param {Number} userId - User ID
     * @returns {Promise}
     */
    async getBalance(userId) {
        try {
            const query = `
                SELECT blnce_amt FROM ${this.tableName}
                WHERE usr_id = ${userId} AND a_in = 1
            `;
            const results = await this.executeQuery(query);
            return results && results.length > 0 ? results[0].blnce_amt : 0;
        } catch (error) {
            console.error('[WalletModel] getBalance error:', error);
            throw error;
        }
    }
}

class WalletTransactionModel extends BaseModel {
    constructor() {
        super('wallet_transactions_t');
    }

    /**
     * Create wallet transaction
     * @param {Object} transactionData - Transaction data
     * @returns {Promise}
     */
    async createTransaction(transactionData) {
        try {
            const {
                walletId,
                userId,
                type,
                category,
                amount,
                balanceBefore,
                balanceAfter,
                description,
                referenceId,
                referenceType,
                paymentMethod,
                paymentDetails,
                status = 'completed'
            } = transactionData;

            const data = {
                wllt_id: walletId,
                usr_id: userId,
                trxn_typ_cd: type,
                trxn_ctgry_cd: category,
                amt: amount,
                blnce_bfr_amt: balanceBefore,
                blnce_aftr_amt: balanceAfter,
                dscrptn_tx: description || null,
                ref_id: referenceId || null,
                ref_typ_cd: referenceType || null,
                pymnt_mthd_cd: paymentMethod || null,
                pymnt_dtls_json: paymentDetails ? JSON.stringify(paymentDetails) : null,
                sttus_cd: status,
                a_in: 1
            };

            return await this.create(data);
        } catch (error) {
            console.error('[WalletTransactionModel] createTransaction error:', error);
            throw error;
        }
    }

    /**
     * Get user transactions
     * @param {Number} userId - User ID
     * @param {Object} options - Query options (limit, offset)
     * @returns {Promise}
     */
    async getUserTransactions(userId, options = {}) {
        try {
            const limit = options.limit || 50;
            const offset = options.offset || 0;

            const query = `
                SELECT * FROM ${this.tableName}
                WHERE usr_id = ${userId} AND a_in = 1
                ORDER BY i_ts DESC
                LIMIT ${limit} OFFSET ${offset}
            `;
            return await this.executeQuery(query);
        } catch (error) {
            console.error('[WalletTransactionModel] getUserTransactions error:', error);
            throw error;
        }
    }

    /**
     * Get transaction by reference
     * @param {String} referenceType - Reference type
     * @param {Number} referenceId - Reference ID
     * @returns {Promise}
     */
    async getByReference(referenceType, referenceId) {
        try {
            return await this.findOne({
                ref_typ_cd: referenceType,
                ref_id: referenceId
            });
        } catch (error) {
            console.error('[WalletTransactionModel] getByReference error:', error);
            throw error;
        }
    }
}

module.exports = {
    Wallet: new WalletModel(),
    WalletTransaction: new WalletTransactionModel()
};
