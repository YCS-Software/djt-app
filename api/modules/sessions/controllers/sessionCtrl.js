/**
 * Charging Session Controller
 * Handles charging session operations
 */

const sessionMdl = require('../models/sessionMdl');
const walletMdl = require('../../wallet/models/walletMdl');
const stationMdl = require('../../stations/models/stationMdl');
const std = require(appRoot + '/utils/standardMessages');
const df = require(appRoot + '/utils/dateFormatUtil');
const cntxtDtls = "sessionCtrl";

/**
 * Generate unique session code
 */
const generateSessionCode = () => {
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
    const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `SES-${dateStr}-${randomStr}`;
};

/**
 * Start charging session
 */
exports.startSession = function(req, res) {
    var fnm = "startSession";
    const userId = req.user.userId;
    const { station_id, connector_id, qr_code, selected_units, total_amount } = req.body;

    if (!station_id || !connector_id) {
        return res.status(std.message["BAD_REQUEST"].code).json({
            status: std.message["BAD_REQUEST"].code,
            message: 'Station ID and Connector ID are required',
            data: null
        });
    }

    // Get station details
    stationMdl.getStationByIdMdl({ stationId: station_id })
        .then(function(stationResults) {
            if (!stationResults || stationResults.length === 0) {
                return res.status(std.message["NOT_FOUND"].code).json({
                    status: std.message["NOT_FOUND"].code,
                    message: 'Station not found',
                    data: null
                });
            }
            const station = stationResults[0];

            // Check if user has active session
            return sessionMdl.getActiveSessionMdl({ userId: userId })
                .then(function(activeSessionResults) {
                    if (activeSessionResults && activeSessionResults.length > 0) {
                        return res.status(std.message["BAD_REQUEST"].code).json({
                            status: std.message["BAD_REQUEST"].code,
                            message: 'You already have an active charging session',
                            data: null
                        });
                    }

                    // Check wallet balance
                    return walletMdl.getUserWalletMdl({ userId: userId })
                        .then(function(walletResults) {
                            if (!walletResults || walletResults.length === 0) {
                                return res.status(std.message["BAD_REQUEST"].code).json({
                                    status: std.message["BAD_REQUEST"].code,
                                    message: 'Wallet not found. Please contact support.',
                                    data: null
                                });
                            }

                            const wallet = walletResults[0];
                            const walletBalance = parseFloat(wallet.blnce_amt) || 0;
                            
                            // Calculate total amount to deduct (use provided total_amount or calculate from selected_units)
                            let totalAmountToDeduct = 0;
                            if (total_amount && total_amount > 0) {
                                totalAmountToDeduct = parseFloat(total_amount);
                            } else if (selected_units && selected_units > 0) {
                                totalAmountToDeduct = parseFloat(selected_units) * parseFloat(station.prce_per_kwh_amt);
                            } else {
                                // Default: at least 1 kWh worth
                                totalAmountToDeduct = parseFloat(station.prce_per_kwh_amt) * 1;
                            }
                            
                            // Verify wallet has sufficient balance
                            if (walletBalance < totalAmountToDeduct) {
                                return res.status(std.message["BAD_REQUEST"].code).json({
                                    status: std.message["BAD_REQUEST"].code,
                                    message: `Insufficient wallet balance. Required: ₹${totalAmountToDeduct.toFixed(2)}, Available: ₹${walletBalance.toFixed(2)}`,
                                    data: null
                                });
                            }

                            // Create session
                            const sessionCode = generateSessionCode();
                            return sessionMdl.createSessionMdl({
                                sessionCode: sessionCode,
                                userId: userId,
                                stationId: station_id,
                                connectorId: connector_id,
                                pricePerKwh: station.prce_per_kwh_amt,
                                qrCode: qr_code
                            })
                            .then(function(createResults) {
                                if (!createResults || !createResults.insertId) {
                                    throw new Error('Failed to create session');
                                }

                                const sessionId = createResults.insertId;

                                // Deduct amount from wallet before starting session
                                const balanceBefore = walletBalance;
                                const balanceAfter = balanceBefore - totalAmountToDeduct;

                                return walletMdl.deductMoneyMdl({ 
                                    walletId: wallet.wllt_id, 
                                    amount: totalAmountToDeduct, 
                                    userId: userId 
                                })
                                .then(function() {
                                    // Verify wallet was updated
                                    return walletMdl.getUserWalletMdl({ userId: userId });
                                })
                                .then(function(updatedWalletResults) {
                                    if (!updatedWalletResults || updatedWalletResults.length === 0) {
                                        throw new Error('Failed to verify wallet update');
                                    }

                                    const updatedWallet = updatedWalletResults[0];
                                    const actualBalance = parseFloat(updatedWallet.blnce_amt) || 0;

                                    // Verify balance matches expected value
                                    if (Math.abs(actualBalance - balanceAfter) > 0.01) {
                                        throw new Error(`Wallet balance mismatch: expected ${balanceAfter}, got ${actualBalance}`);
                                    }

                                    // Create transaction record for prepayment
                                    return walletMdl.createTransactionMdl({
                                        walletId: wallet.wllt_id,
                                        userId: userId,
                                        type: 'debit',
                                        category: 'charging',
                                        amount: totalAmountToDeduct,
                                        balanceBefore: balanceBefore,
                                        balanceAfter: balanceAfter,
                                        description: `Charging session prepayment - ${sessionCode}`,
                                        status: 'completed',
                                        referenceId: sessionId.toString(),
                                        referenceType: 'session'
                                    });
                                })
                                .then(function(transactionResults) {
                                    // Verify transaction was created
                                    if (!transactionResults || !transactionResults.insertId) {
                                        throw new Error('Failed to create wallet transaction');
                                    }

                                    // Update session with prepaid amount and transaction ID
                                    return sessionMdl.updatePaymentStatusMdl({ 
                                        sessionId: sessionId, 
                                        status: 'paid', 
                                        transactionId: transactionResults.insertId 
                                    })
                                    .then(function() {
                                        // Start the session
                                        return sessionMdl.startSessionMdl({ sessionId: sessionId });
                                    })
                                    .then(function() {
                                        // Update session with prepaid amount (store in ttl_cst_amt as prepaid)
                                        return sessionMdl.updateProgressMdl({
                                            sessionId: sessionId,
                                            progress: 0,
                                            energyConsumed: 0,
                                            currentCost: totalAmountToDeduct
                                        });
                                    })
                                    .then(function() {
                                        // Get connector details
                                        return stationMdl.getConnectorByIdMdl({ connectorId: connector_id })
                                            .then(function(connectorResults) {
                                                const connector = (connectorResults && connectorResults.length > 0) ? connectorResults[0] : null;

                                                return df.formatSucessRes(req, res, {
                                                    session_id: sessionId,
                                                    session_code: sessionCode,
                                                    station_name: station.sttn_nm_tx,
                                                    connector_type: connector ? connector.cnntr_typ_cd : null,
                                                    price_per_kwh: parseFloat(station.prce_per_kwh_amt),
                                                    prepaid_amount: totalAmountToDeduct,
                                                    status: 'active',
                                                    start_time: new Date().toISOString()
                                                }, cntxtDtls, fnm, { message: 'Charging session started' });
                                            });
                                    });
                                });
                            });
                        });
                });
        })
        .catch(function(error) {
            console.error('[SessionCtrl] startSession error:', error);
            return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
        });
};

/**
 * Stop charging session
 */
exports.stopSession = function(req, res) {
    var fnm = "stopSession";
    const userId = req.user.userId;
    const { session_id } = req.body;

    if (!session_id) {
        return res.status(std.message["BAD_REQUEST"].code).json({
            status: std.message["BAD_REQUEST"].code,
            message: 'Session ID is required',
            data: null
        });
    }

    // Get session
    sessionMdl.getSessionByIdMdl({ sessionId: session_id })
        .then(function(sessionResults) {
            if (!sessionResults || sessionResults.length === 0) {
                return res.status(std.message["NOT_FOUND"].code).json({
                    status: std.message["NOT_FOUND"].code,
                    message: 'Session not found',
                    data: null
                });
            }

            const session = sessionResults[0];

            if (session.usr_id !== userId) {
                return res.status(std.message["NOT_FOUND"].code).json({
                    status: std.message["NOT_FOUND"].code,
                    message: 'Session not found',
                    data: null
                });
            }

            if (session.sttus_cd !== 'active') {
                return res.status(std.message["BAD_REQUEST"].code).json({
                    status: std.message["BAD_REQUEST"].code,
                    message: 'Session is not active',
                    data: null
                });
            }

            // Calculate energy and cost based on actual consumption
            const energyConsumed = parseFloat(session.enrgy_cnsmd_kwh) || 0;
            const actualTotalCost = energyConsumed * parseFloat(session.prce_per_kwh_amt);
            const prepaidAmount = parseFloat(session.ttl_cst_amt) || 0;
            const paymentAlreadyMade = session.pymnt_sttus_cd === 'paid';

            // Get wallet
            return walletMdl.getUserWalletMdl({ userId: userId })
                .then(function(walletResults) {
                    if (!walletResults || walletResults.length === 0) {
                        return res.status(std.message["BAD_REQUEST"].code).json({
                            status: std.message["BAD_REQUEST"].code,
                            message: 'Wallet not found. Cannot process payment.',
                            data: null
                        });
                    }

                    const wallet = walletResults[0];
                    const walletBalance = parseFloat(wallet.blnce_amt) || 0;

                    // If payment was already made upfront, calculate difference
                    if (paymentAlreadyMade && prepaidAmount > 0) {
                        const costDifference = actualTotalCost - prepaidAmount;
                        
                        // Stop session with actual cost
                        return sessionMdl.stopSessionMdl({ 
                            sessionId: session_id, 
                            energyConsumed: energyConsumed, 
                            totalCost: actualTotalCost 
                        })
                        .then(function() {
                            // If actual cost is less than prepaid, refund the difference
                            if (costDifference < 0) {
                                const refundAmount = Math.abs(costDifference);
                                const balanceBefore = walletBalance;
                                const balanceAfter = balanceBefore + refundAmount;

                                return walletMdl.addMoneyMdl({ 
                                    walletId: wallet.wllt_id, 
                                    amount: refundAmount, 
                                    userId: userId 
                                })
                                .then(function() {
                                    // Verify wallet was updated
                                    return walletMdl.getUserWalletMdl({ userId: userId });
                                })
                                .then(function(updatedWalletResults) {
                                    if (!updatedWalletResults || updatedWalletResults.length === 0) {
                                        throw new Error('Failed to verify wallet update');
                                    }

                                    const updatedWallet = updatedWalletResults[0];
                                    const actualBalance = parseFloat(updatedWallet.blnce_amt) || 0;

                                    // Verify balance matches expected value
                                    if (Math.abs(actualBalance - balanceAfter) > 0.01) {
                                        throw new Error(`Wallet balance mismatch: expected ${balanceAfter}, got ${actualBalance}`);
                                    }

                                    // Create refund transaction record
                                    return walletMdl.createTransactionMdl({
                                        walletId: wallet.wllt_id,
                                        userId: userId,
                                        type: 'credit',
                                        category: 'refund',
                                        amount: refundAmount,
                                        balanceBefore: balanceBefore,
                                        balanceAfter: balanceAfter,
                                        description: `Charging session refund - ${session.sssn_cd || 'Session ' + session_id} (Prepaid: ₹${prepaidAmount.toFixed(2)}, Actual: ₹${actualTotalCost.toFixed(2)})`,
                                        status: 'completed',
                                        referenceId: session_id.toString(),
                                        referenceType: 'session'
                                    });
                                })
                                .then(function() {
                                    return df.formatSucessRes(req, res, {
                                        session_id: session_id,
                                        duration_minutes: session.durn_mnts_nbr || 0,
                                        energy_consumed: energyConsumed,
                                        prepaid_amount: prepaidAmount,
                                        actual_cost: actualTotalCost,
                                        refund_amount: Math.abs(costDifference),
                                        total_cost: actualTotalCost,
                                        status: 'completed',
                                        end_time: new Date().toISOString()
                                    }, cntxtDtls, fnm, { message: 'Charging session stopped' });
                                });
                            } 
                            // If actual cost is more than prepaid, deduct additional amount
                            else if (costDifference > 0) {
                                if (walletBalance < costDifference) {
                                    // Cannot pay additional amount, mark as pending
                                    return sessionMdl.updatePaymentStatusMdl({ 
                                        sessionId: session_id, 
                                        status: 'pending', 
                                        transactionId: null 
                                    })
                                    .then(function() {
                                        return res.status(std.message["BAD_REQUEST"].code).json({
                                            status: std.message["BAD_REQUEST"].code,
                                            message: `Additional payment required. Required: ₹${costDifference.toFixed(2)}, Available: ₹${walletBalance.toFixed(2)}`,
                                            data: {
                                                session_id: session_id,
                                                energy_consumed: energyConsumed,
                                                prepaid_amount: prepaidAmount,
                                                actual_cost: actualTotalCost,
                                                additional_required: costDifference,
                                                status: 'completed',
                                                payment_status: 'pending'
                                            }
                                        });
                                    });
                                }

                                const balanceBefore = walletBalance;
                                const balanceAfter = balanceBefore - costDifference;

                                return walletMdl.deductMoneyMdl({ 
                                    walletId: wallet.wllt_id, 
                                    amount: costDifference, 
                                    userId: userId 
                                })
                                .then(function() {
                                    // Verify wallet was updated
                                    return walletMdl.getUserWalletMdl({ userId: userId });
                                })
                                .then(function(updatedWalletResults) {
                                    if (!updatedWalletResults || updatedWalletResults.length === 0) {
                                        throw new Error('Failed to verify wallet update');
                                    }

                                    const updatedWallet = updatedWalletResults[0];
                                    const actualBalance = parseFloat(updatedWallet.blnce_amt) || 0;

                                    // Verify balance matches expected value
                                    if (Math.abs(actualBalance - balanceAfter) > 0.01) {
                                        throw new Error(`Wallet balance mismatch: expected ${balanceAfter}, got ${actualBalance}`);
                                    }

                                    // Create additional payment transaction record
                                    return walletMdl.createTransactionMdl({
                                        walletId: wallet.wllt_id,
                                        userId: userId,
                                        type: 'debit',
                                        category: 'charging',
                                        amount: costDifference,
                                        balanceBefore: balanceBefore,
                                        balanceAfter: balanceAfter,
                                        description: `Charging session additional payment - ${session.sssn_cd || 'Session ' + session_id} (Prepaid: ₹${prepaidAmount.toFixed(2)}, Actual: ₹${actualTotalCost.toFixed(2)})`,
                                        status: 'completed',
                                        referenceId: session_id.toString(),
                                        referenceType: 'session'
                                    });
                                })
                                .then(function() {
                                    return df.formatSucessRes(req, res, {
                                        session_id: session_id,
                                        duration_minutes: session.durn_mnts_nbr || 0,
                                        energy_consumed: energyConsumed,
                                        prepaid_amount: prepaidAmount,
                                        actual_cost: actualTotalCost,
                                        additional_paid: costDifference,
                                        total_cost: actualTotalCost,
                                        status: 'completed',
                                        end_time: new Date().toISOString()
                                    }, cntxtDtls, fnm, { message: 'Charging session stopped' });
                                });
                            }
                            // If actual cost equals prepaid, no additional transaction needed
                            else {
                                return df.formatSucessRes(req, res, {
                                    session_id: session_id,
                                    duration_minutes: session.durn_mnts_nbr || 0,
                                    energy_consumed: energyConsumed,
                                    prepaid_amount: prepaidAmount,
                                    actual_cost: actualTotalCost,
                                    total_cost: actualTotalCost,
                                    status: 'completed',
                                    end_time: new Date().toISOString()
                                }, cntxtDtls, fnm, { message: 'Charging session stopped' });
                            }
                        });
                    }
                    // If payment was not made upfront, deduct now (old flow for backward compatibility)
                    else {
                        // Verify wallet has sufficient balance
                        if (walletBalance < actualTotalCost) {
                            // Stop session but mark payment as failed
                            return sessionMdl.stopSessionMdl({ 
                                sessionId: session_id, 
                                energyConsumed: energyConsumed, 
                                totalCost: actualTotalCost 
                            })
                            .then(function() {
                                return sessionMdl.updatePaymentStatusMdl({ 
                                    sessionId: session_id, 
                                    status: 'pending', 
                                    transactionId: null 
                                });
                            })
                            .then(function() {
                                return res.status(std.message["BAD_REQUEST"].code).json({
                                    status: std.message["BAD_REQUEST"].code,
                                    message: `Insufficient wallet balance. Required: ₹${actualTotalCost.toFixed(2)}, Available: ₹${walletBalance.toFixed(2)}`,
                                    data: {
                                        session_id: session_id,
                                        energy_consumed: energyConsumed,
                                        total_cost: actualTotalCost,
                                        wallet_balance: walletBalance,
                                        status: 'completed',
                                        payment_status: 'pending'
                                    }
                                });
                            });
                        }

                        // Stop session
                        return sessionMdl.stopSessionMdl({ 
                            sessionId: session_id, 
                            energyConsumed: energyConsumed, 
                            totalCost: actualTotalCost 
                        })
                        .then(function() {
                            // Deduct from wallet
                            const balanceBefore = walletBalance;
                            const balanceAfter = balanceBefore - actualTotalCost;

                            return walletMdl.deductMoneyMdl({ 
                                walletId: wallet.wllt_id, 
                                amount: actualTotalCost, 
                                userId: userId 
                            })
                            .then(function() {
                                // Verify wallet was updated
                                return walletMdl.getUserWalletMdl({ userId: userId });
                            })
                            .then(function(updatedWalletResults) {
                                if (!updatedWalletResults || updatedWalletResults.length === 0) {
                                    throw new Error('Failed to verify wallet update');
                                }

                                const updatedWallet = updatedWalletResults[0];
                                const actualBalance = parseFloat(updatedWallet.blnce_amt) || 0;

                                // Verify balance matches expected value
                                if (Math.abs(actualBalance - balanceAfter) > 0.01) {
                                    throw new Error(`Wallet balance mismatch: expected ${balanceAfter}, got ${actualBalance}`);
                                }

                                // Create transaction record
                                return walletMdl.createTransactionMdl({
                                    walletId: wallet.wllt_id,
                                    userId: userId,
                                    type: 'debit',
                                    category: 'charging',
                                    amount: actualTotalCost,
                                    balanceBefore: balanceBefore,
                                    balanceAfter: balanceAfter,
                                    description: `Charging session payment - ${session.sssn_cd || 'Session ' + session_id}`,
                                    status: 'completed',
                                    referenceId: session_id.toString(),
                                    referenceType: 'session'
                                });
                            })
                            .then(function(transactionResults) {
                                // Verify transaction was created
                                if (!transactionResults || !transactionResults.insertId) {
                                    throw new Error('Failed to create wallet transaction');
                                }

                                // Update session payment status
                                return sessionMdl.updatePaymentStatusMdl({ 
                                    sessionId: session_id, 
                                    status: 'paid', 
                                    transactionId: transactionResults.insertId 
                                })
                                .then(function() {
                                    return df.formatSucessRes(req, res, {
                                        session_id: session_id,
                                        duration_minutes: session.durn_mnts_nbr || 0,
                                        energy_consumed: energyConsumed,
                                        total_cost: actualTotalCost,
                                        status: 'completed',
                                        end_time: new Date().toISOString()
                                    }, cntxtDtls, fnm, { message: 'Charging session stopped' });
                                });
                            });
                        });
                    }
                });
        })
        .catch(function(error) {
            console.error('[SessionCtrl] stopSession error:', error);
            return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
        });
};

/**
 * Get active session
 */
exports.getActiveSession = function(req, res) {
    var fnm = "getActiveSession";
    const userId = req.user.userId;

    sessionMdl.getActiveSessionMdl({ userId: userId })
        .then(function(sessionResults) {
            if (!sessionResults || sessionResults.length === 0) {
                return df.formatSucessRes(req, res, { session: null }, cntxtDtls, fnm, {});
            }

            const session = sessionResults[0];
            const sessionData = {
                session_id: session.sssn_id,
                station_name: session.sttn_nm_tx,
                connector_type: session.cnntr_typ_cd,
                start_time: session.strt_ts,
                duration_minutes: session.durn_mnts_nbr || 0,
                energy_consumed: parseFloat(session.enrgy_cnsmd_kwh) || 0,
                current_cost: parseFloat(session.ttl_cst_amt) || 0,
                progress: session.prgrss_pct || 0,
                status: session.sttus_cd
            };

            return df.formatSucessRes(req, res, { session: sessionData }, cntxtDtls, fnm, {});
        })
        .catch(function(error) {
            console.error('[SessionCtrl] getActiveSession error:', error);
            return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
        });
};

/**
 * Get session history
 */
exports.getSessionHistory = function(req, res) {
    var fnm = "getSessionHistory";
    const userId = req.user.userId;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const status = req.query.status;

    sessionMdl.getUserSessionsMdl({ userId: userId, limit: limit, offset: offset, status: status })
        .then(function(sessions) {
            const formattedSessions = sessions ? sessions.map(function(s) {
                return {
                    session_id: s.sssn_id,
                    station_name: s.sttn_nm_tx,
                    date: s.i_ts ? new Date(s.i_ts).toISOString().split('T')[0] : null,
                    start_time: s.strt_ts,
                    duration_minutes: s.durn_mnts_nbr,
                    energy_consumed: parseFloat(s.enrgy_cnsmd_kwh) || 0,
                    cost: parseFloat(s.ttl_cst_amt) || 0,
                    status: s.sttus_cd
                };
            }) : [];

            return df.formatSucessRes(req, res, {
                sessions: formattedSessions,
                total: formattedSessions.length,
                limit: limit,
                offset: offset
            }, cntxtDtls, fnm, {});
        })
        .catch(function(error) {
            console.error('[SessionCtrl] getSessionHistory error:', error);
            return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
        });
};

/**
 * Get session details
 */
exports.getSessionDetails = function(req, res) {
    var fnm = "getSessionDetails";
    const userId = req.user.userId;
    const { sessionId } = req.params;

    if (!sessionId) {
        return res.status(std.message["BAD_REQUEST"].code).json({
            status: std.message["BAD_REQUEST"].code,
            message: 'Session ID is required',
            data: null
        });
    }

    sessionMdl.getUserSessionsMdl({ userId: userId, limit: 100, offset: 0 })
        .then(function(sessions) {
            if (!sessions || sessions.length === 0) {
                return res.status(std.message["NOT_FOUND"].code).json({
                    status: std.message["NOT_FOUND"].code,
                    message: 'Session not found',
                    data: null
                });
            }

            const session = sessions.find(function(s) { return s.sssn_id == sessionId; });

            if (!session) {
                return res.status(std.message["NOT_FOUND"].code).json({
                    status: std.message["NOT_FOUND"].code,
                    message: 'Session not found',
                    data: null
                });
            }

            const sessionData = {
                session_id: session.sssn_id,
                session_code: session.sssn_cd,
                station: {
                    name: session.sttn_nm_tx,
                    address: session.addr_tx
                },
                connector_type: session.cnntr_typ_cd,
                start_time: session.strt_ts,
                end_time: session.end_ts,
                duration_minutes: session.durn_mnts_nbr,
                energy_consumed: parseFloat(session.enrgy_cnsmd_kwh) || 0,
                price_per_kwh: parseFloat(session.prce_per_kwh_amt),
                total_cost: parseFloat(session.ttl_cst_amt) || 0,
                status: session.sttus_cd,
                payment_status: session.pymnt_sttus_cd
            };

            return df.formatSucessRes(req, res, { session: sessionData }, cntxtDtls, fnm, {});
        })
        .catch(function(error) {
            console.error('[SessionCtrl] getSessionDetails error:', error);
            return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
        });
};
