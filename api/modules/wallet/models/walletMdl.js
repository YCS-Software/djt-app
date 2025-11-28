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
    const QRY_TO_EXEC = `SELECT * FROM wallet_t 
        WHERE usr_id = ${data.userId} 
        AND a_in = 1 
        LIMIT 1`;
    
    console.log('[getUserWalletMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};

/*****************************************************************************
* Function      : createWalletMdl
* Description   : Create new wallet for user
* Arguments     : data object with userId and optional initialAmount
******************************************************************************/
exports.createWalletMdl = function(data) {
    const initialAmount = data.initialAmount || 0.00;
    const QRY_TO_EXEC = `INSERT INTO wallet_t 
        (usr_id, blnce_amt, a_in) 
        VALUES 
        (${data.userId}, ${initialAmount}, 1)`;
    
    console.log('[createWalletMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};

/*****************************************************************************
* Function      : addMoneyMdl
* Description   : Add money to wallet
* Arguments     : data object with walletId, amount
******************************************************************************/
exports.addMoneyMdl = function(data) {
    const QRY_TO_EXEC = `UPDATE wallet_t 
        SET blnce_amt = blnce_amt + ${data.amount}, 
            lst_updtd_ts = NOW(), 
            updte_usr_id = ${data.userId}
        WHERE wllt_id = ${data.walletId}`;
    
    console.log('[addMoneyMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};

/*****************************************************************************
* Function      : deductMoneyMdl
* Description   : Deduct money from wallet
* Arguments     : data object with walletId, amount
******************************************************************************/
exports.deductMoneyMdl = function(data) {
    const QRY_TO_EXEC = `UPDATE wallet_t 
        SET blnce_amt = blnce_amt - ${data.amount}, 
            lst_updtd_ts = NOW(), 
            updte_usr_id = ${data.userId}
        WHERE wllt_id = ${data.walletId}`;
    
    console.log('[deductMoneyMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};

/*****************************************************************************
* Function      : createTransactionMdl
* Description   : Create wallet transaction record
* Arguments     : data object with transaction details
******************************************************************************/
exports.createTransactionMdl = function(data) {
    const referenceId = data.referenceId ? `'${String(data.referenceId).replace(/'/g, "''")}'` : 'NULL';
    const referenceType = data.referenceType ? `'${String(data.referenceType).replace(/'/g, "''")}'` : 'NULL';
    const paymentMethod = data.paymentMethod ? `'${String(data.paymentMethod).replace(/'/g, "''")}'` : 'NULL';
    const paymentDetails = data.paymentDetails ? `'${JSON.stringify(data.paymentDetails).replace(/'/g, "''")}'` : 'NULL';
    const description = data.description ? `'${String(data.description).replace(/'/g, "''")}'` : 'NULL';
    
    const QRY_TO_EXEC = `INSERT INTO wallet_transactions_t 
        (wllt_id, usr_id, trxn_typ_cd, trxn_ctgry_cd, amt, 
         blnce_bfr_amt, blnce_aftr_amt, dscrptn_tx, 
         pymnt_mthd_cd, pymnt_dtls_json, ref_id, ref_typ_cd, 
         sttus_cd, a_in) 
        VALUES 
        (${data.walletId}, ${data.userId}, '${data.type}', '${data.category}', 
         ${data.amount}, ${data.balanceBefore}, ${data.balanceAfter}, 
         ${description}, ${paymentMethod}, ${paymentDetails}, 
         ${referenceId}, ${referenceType}, '${data.status}', 1)`;
    
    console.log('[createTransactionMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};

/*****************************************************************************
* Function      : getUserTransactionsMdl
* Description   : Get user transaction history
* Arguments     : data object with userId, limit, offset
******************************************************************************/
exports.getUserTransactionsMdl = function(data) {
    const limit = data.limit || 50;
    const offset = data.offset || 0;
    
    const QRY_TO_EXEC = `SELECT * FROM wallet_transactions_t 
        WHERE usr_id = ${data.userId} 
        AND a_in = 1 
        ORDER BY i_ts DESC 
        LIMIT ${limit} OFFSET ${offset}`;
    
    console.log('[getUserTransactionsMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};
