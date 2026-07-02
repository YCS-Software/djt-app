/**
 * Wallet Model
 * Handles wallet-related database operations
 */

const sqldb = require(appRoot + '/config/db.config');
const dbutil = require(appRoot + '/utils/db.utils');
const cntxtDtls = "walletMdl";

/*****************************************************************************
* Function      : getUserWalletMdl
* Description   : Get user wallet by user ID
* Arguments     : data object with userId
******************************************************************************/
exports.getUserWalletMdl = function(data) {
    const QRY_TO_EXEC = `SELECT * FROM wllt_lst_t
        WHERE usr_id = ?
        AND a_in = 1
        LIMIT 1`;
    const PARAMS = [data.userId];

    console.log('[getUserWalletMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

/*****************************************************************************
* Function      : createWalletMdl
* Description   : Create new wallet for user
* Arguments     : data object with userId and optional initialAmount
******************************************************************************/
exports.createWalletMdl = function(data) {
    const initialAmount = data.initialAmount || 0.00;
    const QRY_TO_EXEC = `INSERT INTO wllt_lst_t
        (usr_id, blnce_amt, a_in)
        VALUES
        (?, ?, 1)`;
    const PARAMS = [data.userId, initialAmount];

    console.log('[createWalletMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

/*****************************************************************************
* Function      : addMoneyMdl
* Description   : Add money to wallet
* Arguments     : data object with walletId, amount
******************************************************************************/
exports.addMoneyMdl = function(data) {
    const QRY_TO_EXEC = `UPDATE wllt_lst_t
        SET blnce_amt = blnce_amt + ?,
            lst_updtd_ts = NOW()
        WHERE wllt_id = ?`;
    const PARAMS = [data.amount, data.walletId];

    console.log('[addMoneyMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

/*****************************************************************************
* Function      : deductMoneyMdl
* Description   : Deduct money from wallet
* Arguments     : data object with walletId, amount
******************************************************************************/
exports.deductMoneyMdl = function(data) {
    const QRY_TO_EXEC = `UPDATE wllt_lst_t
        SET blnce_amt = blnce_amt - ?,
            lst_updtd_ts = NOW()
        WHERE wllt_id = ?`;
    const PARAMS = [data.amount, data.walletId];

    console.log('[deductMoneyMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

/*****************************************************************************
* Function      : createTransactionMdl
* Description   : Create wallet transaction record
* Arguments     : data object with transaction details
******************************************************************************/
exports.createTransactionMdl = function(data) {
    const referenceId = data.referenceId ? String(data.referenceId) : null;
    const referenceType = data.referenceType ? String(data.referenceType) : null;
    const paymentMethod = data.paymentMethod ? String(data.paymentMethod) : null;
    const paymentDetails = data.paymentDetails ? JSON.stringify(data.paymentDetails) : null;
    const description = data.description ? String(data.description) : null;

    const QRY_TO_EXEC = `INSERT INTO trxn_lst_t
        (wllt_id, usr_id, trxn_typ_cd, trxn_ctgry_cd, amt,
         blnce_bfr_amt, blnce_aftr_amt, dscrptn_tx,
         pymnt_mthd_cd, pymnt_dtls_json, ref_id, ref_typ_cd,
         sttus_cd, a_in)
        VALUES
        (?, ?, ?, ?,
         ?, ?, ?,
         ?, ?, ?,
         ?, ?, ?, 1)`;
    const PARAMS = [data.walletId, data.userId, data.type, data.category,
        data.amount, data.balanceBefore, data.balanceAfter,
        description, paymentMethod, paymentDetails,
        referenceId, referenceType, data.status];

    console.log('[createTransactionMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

/*****************************************************************************
* Function      : getUserTransactionsMdl
* Description   : Get user transaction history
* Arguments     : data object with userId, limit, offset
******************************************************************************/
exports.getUserTransactionsMdl = function(data) {
    const limit = Number.isFinite(+data.limit) && +data.limit ? Math.max(0, parseInt(data.limit, 10)) : 50;
    const offset = Number.isFinite(+data.offset) && +data.offset ? Math.max(0, parseInt(data.offset, 10)) : 0;

    const QRY_TO_EXEC = `SELECT * FROM trxn_lst_t
        WHERE usr_id = ?
        AND a_in = 1
        ORDER BY i_ts DESC
        LIMIT ${limit} OFFSET ${offset}`;
    const PARAMS = [data.userId];

    console.log('[getUserTransactionsMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};
