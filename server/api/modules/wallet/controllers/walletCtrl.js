/**
 * Wallet Controller
 * Handles wallet and transaction operations
 */

const std = require(appRoot + '/utils/standardMessages');
const df = require(appRoot + '/utils/dateFormatUtil');
const walletMdl = require('../models/walletMdl');
const cntxtDtls = "walletCtrl";

/*****************************************************************************
* Function      : getBalance
* Description   : Get wallet balance
* Arguments     : req, res
******************************************************************************/
exports.getBalance = function(req, res) {
    let data = req.body.data ? req.body.data : req.body;
    var fnm = "getBalance";
    
    const userId = req.user.userId;
    
    walletMdl.getUserWalletMdl({ userId: userId })
        .then(function(walletResults) {
            if (!walletResults || walletResults.length === 0) {
                // Create wallet if doesn't exist
                return walletMdl.createWalletMdl({ userId: userId })
                    .then(function(createResults) {
                        return df.formatSucessRes(req, res, {
                            wallet_id: createResults.insertId,
                            balance: 0,
                            last_updated: new Date().toISOString()
                        }, cntxtDtls, fnm, {});
                    });
            }
            
            const wallet = walletResults[0];
            return df.formatSucessRes(req, res, {
                wallet_id: wallet.wllt_id,
                balance: parseFloat(wallet.blnce_amt),
                last_updated: wallet.lst_updtd_ts
            }, cntxtDtls, fnm, {});
        })
        .catch(function(error) {
            console.error('[getBalance] Error:', error);
            return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
        });
};

/*****************************************************************************
* Function      : addMoney
* Description   : Add money to wallet
* Arguments     : req, res
******************************************************************************/
exports.addMoney = function(req, res) {
    let data = req.body.data ? req.body.data : req.body;
    var fnm = "addMoney";
    
    const userId = req.user.userId;
    const { amount, payment_method, payment_details } = data;
    
    if (!amount || amount <= 0) {
        return res.status(std.message["BAD_REQUEST"].code).json({
            status: std.message["BAD_REQUEST"].code,
            message: 'Invalid amount',
            data: null
        });
    }
    
    walletMdl.getUserWalletMdl({ userId: userId })
        .then(function(walletResults) {
            let wallet;
            
            if (!walletResults || walletResults.length === 0) {
                // Create wallet if doesn't exist
                return walletMdl.createWalletMdl({ userId: userId })
                    .then(function(createResults) {
                        return walletMdl.getUserWalletMdl({ userId: userId });
                    })
                    .then(function(newWalletResults) {
                        wallet = newWalletResults[0];
                        return processAddMoney(wallet, userId, amount, payment_method, payment_details, req, res, fnm);
                    });
            }
            
            wallet = walletResults[0];
            return processAddMoney(wallet, userId, amount, payment_method, payment_details, req, res, fnm);
        })
        .catch(function(error) {
            console.error('[addMoney] Error:', error);
            return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
        });
};

// Helper function for adding money
function processAddMoney(wallet, userId, amount, payment_method, payment_details, req, res, fnm) {
    const balanceBefore = parseFloat(wallet.blnce_amt);
    const balanceAfter = balanceBefore + parseFloat(amount);
    
    return walletMdl.addMoneyMdl({ walletId: wallet.wllt_id, amount: amount, userId: userId })
        .then(function() {
            // Create transaction record
            return walletMdl.createTransactionMdl({
                walletId: wallet.wllt_id,
                userId: userId,
                type: 'credit',
                category: 'topup',
                amount: amount,
                balanceBefore: balanceBefore,
                balanceAfter: balanceAfter,
                description: `Wallet Top-up via ${payment_method}`,
                paymentMethod: payment_method,
                paymentDetails: payment_details,
                status: 'completed'
            });
        })
        .then(function(transactionResults) {
            return df.formatSucessRes(req, res, {
                transaction_id: transactionResults.insertId,
                amount: parseFloat(amount),
                new_balance: balanceAfter
            }, cntxtDtls, fnm, { message: 'Money added successfully' });
        });
}

/*****************************************************************************
* Function      : getTransactions
* Description   : Get transaction history
* Arguments     : req, res
******************************************************************************/
exports.getTransactions = function(req, res) {
    var fnm = "getTransactions";
    
    const userId = req.user.userId;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    
    walletMdl.getUserTransactionsMdl({ userId: userId, limit: limit, offset: offset })
        .then(function(transactions) {
            const formattedTransactions = transactions.map(function(t) {
                return {
                    trxn_id: t.trxn_id,
                    type: t.trxn_typ_cd,
                    category: t.trxn_ctgry_cd,
                    amount: parseFloat(t.amt),
                    balance_before: parseFloat(t.blnce_bfr_amt),
                    balance_after: parseFloat(t.blnce_aftr_amt),
                    description: t.dscrptn_tx,
                    payment_method: t.pymnt_mthd_cd,
                    status: t.sttus_cd,
                    created_at: t.i_ts
                };
            });
            
            return df.formatSucessRes(req, res, {
                transactions: formattedTransactions,
                total: formattedTransactions.length,
                limit: limit,
                offset: offset
            }, cntxtDtls, fnm, {});
        })
        .catch(function(error) {
            console.error('[getTransactions] Error:', error);
            return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
        });
};

/*****************************************************************************
* Function      : transferMoney
* Description   : Transfer money to another user
* Arguments     : req, res
******************************************************************************/
exports.transferMoney = function(req, res) {
    let data = req.body.data ? req.body.data : req.body;
    var fnm = "transferMoney";
    
    const userId = req.user.userId;
    const { to_phone, amount, note } = data;
    
    if (!to_phone || !amount || amount <= 0) {
        return res.status(std.message["BAD_REQUEST"].code).json({
            status: std.message["BAD_REQUEST"].code,
            message: 'Invalid transfer details',
            data: null
        });
    }
    
    walletMdl.getUserWalletMdl({ userId: userId })
        .then(function(walletResults) {
            if (!walletResults || walletResults.length === 0) {
                return res.status(std.message["BAD_REQUEST"].code).json({
                    status: std.message["BAD_REQUEST"].code,
                    message: 'Wallet not found',
                    data: null
                });
            }
            
            const senderWallet = walletResults[0];
            
            // Check balance
            if (parseFloat(senderWallet.blnce_amt) < parseFloat(amount)) {
                return res.status(std.message["BAD_REQUEST"].code).json({
                    status: std.message["BAD_REQUEST"].code,
                    message: 'Insufficient balance',
                    data: null
                });
            }
            
            const balanceBefore = parseFloat(senderWallet.blnce_amt);
            const balanceAfter = balanceBefore - parseFloat(amount);
            
            // Deduct money
            return walletMdl.deductMoneyMdl({ 
                walletId: senderWallet.wllt_id, 
                amount: amount, 
                userId: userId 
            })
            .then(function() {
                // Create transaction record
                return walletMdl.createTransactionMdl({
                    walletId: senderWallet.wllt_id,
                    userId: userId,
                    type: 'debit',
                    category: 'transfer',
                    amount: amount,
                    balanceBefore: balanceBefore,
                    balanceAfter: balanceAfter,
                    description: `Transfer to ${to_phone}${note ? ': ' + note : ''}`,
                    status: 'completed'
                });
            })
            .then(function(transactionResults) {
                return df.formatSucessRes(req, res, {
                    transaction_id: transactionResults.insertId,
                    amount: parseFloat(amount),
                    new_balance: balanceAfter
                }, cntxtDtls, fnm, { message: 'Transfer successful' });
            });
        })
        .catch(function(error) {
            console.error('[transferMoney] Error:', error);
            return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
        });
};
