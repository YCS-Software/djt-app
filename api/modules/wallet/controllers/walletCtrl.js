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
                // Create wallet if doesn't exist (with balance 0.00)
                return walletMdl.createWalletMdl({ userId: userId, initialAmount: 0.00 })
                    .then(function(createResults) {
                        // Verify wallet was created successfully
                        if (!createResults || !createResults.insertId) {
                            throw new Error('Failed to create wallet');
                        }
                        
                        // Fetch the newly created wallet from database to get real data
                        return walletMdl.getUserWalletMdl({ userId: userId });
                    })
                    .then(function(newWalletResults) {
                        // Verify wallet exists after creation
                        if (!newWalletResults || newWalletResults.length === 0) {
                            throw new Error('Wallet not found after creation');
                        }
                        
                        // Return real data from database
                        const wallet = newWalletResults[0];
                        const balance = parseFloat(wallet.blnce_amt) || 0;
                        
                        return df.formatSucessRes(req, res, {
                            wallet_id: wallet.wllt_id,
                            balance: balance,
                            last_updated: wallet.lst_updtd_ts ? new Date(wallet.lst_updtd_ts).toISOString() : new Date().toISOString()
                        }, cntxtDtls, fnm, {});
                    });
            }
            
            // Wallet exists - return real data from database
            const wallet = walletResults[0];
            const balance = parseFloat(wallet.blnce_amt) || 0;
            
            return df.formatSucessRes(req, res, {
                wallet_id: wallet.wllt_id,
                balance: balance,
                last_updated: wallet.lst_updtd_ts ? new Date(wallet.lst_updtd_ts).toISOString() : new Date().toISOString()
            }, cntxtDtls, fnm, {});
        })
        .catch(function(error) {
            console.error('[getBalance] Error:', error);
            return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
        });
};

/*****************************************************************************
* Function      : addMoney
* Description   : Add money to wallet (called after payment verification)
* Arguments     : req, res
******************************************************************************/
exports.addMoney = function(req, res) {
    let data = req.body.data ? req.body.data : req.body;
    var fnm = "addMoney";
    
    const userId = req.user.userId;
    const { amount, payment_method, payment_details } = data;
    
    // Validate amount
    if (!amount || amount <= 0 || isNaN(amount)) {
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
                // Create wallet with initial balance = amount
                return walletMdl.createWalletMdl({ userId: userId, initialAmount: amount })
                    .then(function(createResults) {
                        // Verify wallet was created successfully
                        if (!createResults || !createResults.insertId) {
                            throw new Error('Failed to create wallet');
                        }
                        return walletMdl.getUserWalletMdl({ userId: userId });
                    })
                    .then(function(newWalletResults) {
                        // Verify wallet exists
                        if (!newWalletResults || newWalletResults.length === 0) {
                            throw new Error('Wallet not found after creation');
                        }
                        wallet = newWalletResults[0];
                        // Verify balance is set correctly
                        const walletBalance = parseFloat(wallet.blnce_amt) || 0;
                        if (Math.abs(walletBalance - parseFloat(amount)) > 0.01) {
                            throw new Error('Wallet balance mismatch after creation');
                        }
                        // For new wallet, balance is already set to amount, so balanceBefore = 0, balanceAfter = amount
                        return processAddMoneyForNewWallet(wallet, userId, amount, payment_method, payment_details, req, res, fnm);
                    });
            }
            
            // Wallet exists - add amount to existing balance
            wallet = walletResults[0];
            const currentBalance = parseFloat(wallet.blnce_amt) || 0;
            return processAddMoney(wallet, userId, amount, currentBalance, payment_method, payment_details, req, res, fnm);
        })
        .catch(function(error) {
            console.error('[addMoney] Error:', error);
            return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
        });
};

// Helper function for adding money to existing wallet (called after payment verification)
function processAddMoney(wallet, userId, amount, currentBalance, payment_method, payment_details, req, res, fnm) {
    const balanceBefore = currentBalance;
    const balanceAfter = balanceBefore + parseFloat(amount);
    let transactionInsertId = null;
    
    return walletMdl.addMoneyMdl({ walletId: wallet.wllt_id, amount: amount, userId: userId })
        .then(function(updateResults) {
            // Verify wallet was updated successfully
            if (!updateResults || updateResults.affectedRows !== 1) {
                throw new Error('Failed to update wallet balance');
            }
            
            // Verify updated balance by fetching wallet again
            return walletMdl.getUserWalletMdl({ userId: userId });
        })
        .then(function(updatedWalletResults) {
            if (!updatedWalletResults || updatedWalletResults.length === 0) {
                throw new Error('Wallet not found after update');
            }
            
            const updatedWallet = updatedWalletResults[0];
            const actualBalance = parseFloat(updatedWallet.blnce_amt) || 0;
            
            // Verify balance matches expected value
            if (Math.abs(actualBalance - balanceAfter) > 0.01) {
                throw new Error(`Balance mismatch: expected ${balanceAfter}, got ${actualBalance}`);
            }
            
            // Create transaction record in trxn_lst_t
            return walletMdl.createTransactionMdl({
                walletId: wallet.wllt_id,
                userId: userId,
                type: 'credit',
                category: 'topup',
                amount: amount,
                balanceBefore: balanceBefore,
                balanceAfter: balanceAfter,
                description: `Wallet Top-up via ${payment_method || 'payment gateway'}`,
                paymentMethod: payment_method,
                paymentDetails: payment_details,
                status: 'completed',
                referenceId: payment_details?.payment_id || payment_details?.order_id,
                referenceType: 'payment'
            });
        })
        .then(function(transactionResults) {
            // Verify transaction was created successfully
            if (!transactionResults || !transactionResults.insertId) {
                throw new Error('Failed to create transaction record');
            }
            
            transactionInsertId = transactionResults.insertId;
            
            // Verify transaction exists in database
            return walletMdl.getUserTransactionsMdl({ userId: userId, limit: 1, offset: 0 });
        })
        .then(function(transactionVerification) {
            // Verify transaction was actually inserted
            if (!transactionVerification || transactionVerification.length === 0) {
                throw new Error('Transaction not found after creation');
            }
            
            const createdTransaction = transactionVerification[0];
            
            // Verify transaction ID matches
            if (parseInt(createdTransaction.trxn_id) !== parseInt(transactionInsertId)) {
                throw new Error(`Transaction ID mismatch: expected ${transactionInsertId}, got ${createdTransaction.trxn_id}`);
            }
            
            // Verify transaction amount matches
            if (Math.abs(parseFloat(createdTransaction.amt) - parseFloat(amount)) > 0.01) {
                throw new Error(`Transaction amount mismatch: expected ${amount}, got ${createdTransaction.amt}`);
            }
            
            // Verify final wallet balance
            return walletMdl.getUserWalletMdl({ userId: userId });
        })
        .then(function(finalWalletVerification) {
            if (!finalWalletVerification || finalWalletVerification.length === 0) {
                throw new Error('Wallet not found after transaction creation');
            }
            
            const finalWallet = finalWalletVerification[0];
            const finalBalance = parseFloat(finalWallet.blnce_amt) || 0;
            
            // Verify final wallet balance matches expected balance
            if (Math.abs(finalBalance - balanceAfter) > 0.01) {
                throw new Error(`Final wallet balance mismatch: expected ${balanceAfter}, got ${finalBalance}`);
            }
            
            // Return success only after all operations are verified
            return df.formatSucessRes(req, res, {
                transaction_id: transactionInsertId,
                amount: parseFloat(amount),
                new_balance: balanceAfter
            }, cntxtDtls, fnm, { message: 'Money added successfully' });
        });
}

// Helper function for new wallet (balance already set to amount during creation)
function processAddMoneyForNewWallet(wallet, userId, amount, payment_method, payment_details, req, res, fnm) {
    const balanceBefore = 0;
    const balanceAfter = parseFloat(amount);
    let transactionInsertId = null;
    
    // Create transaction record in trxn_lst_t (wallet balance already set during creation)
    return walletMdl.createTransactionMdl({
        walletId: wallet.wllt_id,
        userId: userId,
        type: 'credit',
        category: 'topup',
        amount: amount,
        balanceBefore: balanceBefore,
        balanceAfter: balanceAfter,
        description: `Wallet Top-up via ${payment_method || 'payment gateway'}`,
        paymentMethod: payment_method,
        paymentDetails: payment_details,
        status: 'completed',
        referenceId: payment_details?.payment_id || payment_details?.order_id,
        referenceType: 'payment'
    })
    .then(function(transactionResults) {
        // Verify transaction was created successfully
        if (!transactionResults || !transactionResults.insertId) {
            throw new Error('Failed to create transaction record');
        }
        
        transactionInsertId = transactionResults.insertId;
        
        // Verify transaction exists in database
        return walletMdl.getUserTransactionsMdl({ userId: userId, limit: 1, offset: 0 });
    })
    .then(function(transactionVerification) {
        // Verify transaction was actually inserted
        if (!transactionVerification || transactionVerification.length === 0) {
            throw new Error('Transaction not found after creation');
        }
        
        const createdTransaction = transactionVerification[0];
        
        // Verify transaction ID matches
        if (parseInt(createdTransaction.trxn_id) !== parseInt(transactionInsertId)) {
            throw new Error(`Transaction ID mismatch: expected ${transactionInsertId}, got ${createdTransaction.trxn_id}`);
        }
        
        // Verify transaction amount matches
        if (Math.abs(parseFloat(createdTransaction.amt) - parseFloat(amount)) > 0.01) {
            throw new Error(`Transaction amount mismatch: expected ${amount}, got ${createdTransaction.amt}`);
        }
        
        // Verify wallet balance matches
        return walletMdl.getUserWalletMdl({ userId: userId });
    })
    .then(function(walletVerification) {
        if (!walletVerification || walletVerification.length === 0) {
            throw new Error('Wallet not found after transaction creation');
        }
        
        const verifiedWallet = walletVerification[0];
        const actualWalletBalance = parseFloat(verifiedWallet.blnce_amt) || 0;
        
        // Verify wallet balance matches expected balance
        if (Math.abs(actualWalletBalance - balanceAfter) > 0.01) {
            throw new Error(`Wallet balance mismatch: expected ${balanceAfter}, got ${actualWalletBalance}`);
        }
        
        // Return success only after all operations are verified
        return df.formatSucessRes(req, res, {
            transaction_id: transactionInsertId,
            amount: parseFloat(amount),
            new_balance: balanceAfter
        }, cntxtDtls, fnm, { message: 'Money added successfully' });
    });
}

// Removed DUMMY_TRANSACTIONS - all data comes from database only

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
            let formattedTransactions = [];
            
            if (transactions && transactions.length > 0) {
                formattedTransactions = transactions.map(function(t) {
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
            }
            
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
