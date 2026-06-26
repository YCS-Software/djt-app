/**
 * Charging Session Controller
 * Handles charging session operations
 */

const sessionMdl = require('../models/sessionMdl');
const walletMdl = require('../../wallet/models/walletMdl');
const stationMdl = require('../../stations/models/stationMdl');
const std = require(appRoot + '/utils/standardMessages');
const df = require(appRoot + '/utils/dateFormatUtil');
const qrUtil = require(appRoot + '/utils/qrUtil');
const audit = require(appRoot + '/utils/auditUtil');
const ocppServer = require(appRoot + '/api/ocpp/ocppServer');
const ledgerService = require(appRoot + '/api/modules/ledger/services/ledgerService');
const cntxtDtls = "sessionCtrl";

// A charger is "online" only while it holds a live OCPP WebSocket to us.
function isChargerOnline(ocppId) {
    return !!(ocppId && ocppServer.getConnection(ocppId));
}

/**
 * Resolve a scanned machine QR (signed, app-only token) → station + connector.
 * Generic scanners can't use the opaque token; only this endpoint, which holds
 * the secret, verifies the signature and returns the charge target.
 */
/**
 * Pull a charge-point OCPP id out of scanned QR content that ISN'T a signed
 * DJTEV1 token — i.e. a ws-url ("ws://host/ocpp/<id>") or a bare OCPP id
 * (e.g. "DJT-12-CP1-T6I"). Returns null if nothing safe is found.
 */
function extractOcppId(raw) {
    const s = String(raw || '').trim();
    if (!s) return null;
    const m = s.match(/\/ocpp\/([^/?#\s]+)/i);   // ws://.../ocpp/<id>
    if (m) return decodeURIComponent(m[1]);
    if (/^DJT-\d+-CP\d+-[A-Za-z0-9]+$/i.test(s)) return s;  // bare DJT OCPP id
    return null;
}

exports.scanQr = function(req, res) {
    const fnm = "scanQr";
    const data = req.body && req.body.data ? req.body.data : (req.body || {});
    const token = data.token || data.qr || data.qr_code || '';

    // Audit every scan attempt (success and failures), so support can trace
    // exactly who scanned what charger and the outcome (e.g. offline scans).
    const actx = audit.reqCtx(req);
    const auditScan = (result, machineId, detail) => audit.writeAudit({
        userId: actx.userId, action: 'charger_scan', entityType: 'machine',
        entityId: machineId != null ? machineId : null,
        newVal: Object.assign({ result }, detail || {}),
        ip: actx.ip, userAgent: actx.userAgent,
    });

    // Primary: signed app-only token (DJTEV1...). Fallback: a sticker/QR that
    // encodes the raw OCPP id or the charger ws-url (resolve by OCPP id).
    const payload = qrUtil.decode(token);
    let lookup = null;
    if (payload && payload.t === 'machine' && payload.mid) {
        lookup = sessionMdl.getMachineScanInfoMdl({ machineId: payload.mid });
    } else {
        const ocppId = extractOcppId(token);
        if (!ocppId) {
            auditScan('invalid_code');
            return res.status(std.message["BAD_REQUEST"].code).json({
                status: std.message["BAD_REQUEST"].code,
                message: 'This QR code is not a valid DJT charger code',
                data: null
            });
        }
        lookup = sessionMdl.getMachineScanInfoByOcppMdl({ ocppId });
    }

    lookup
        .then(function(rows) {
            if (!rows || rows.length === 0) {
                auditScan('not_found');
                return res.status(std.message["NOT_FOUND"].code).json({
                    status: std.message["NOT_FOUND"].code, message: 'Charger not found', data: null
                });
            }
            const head = rows[0];
            const connectors = rows
                .filter(function(r) { return r.cnntr_id; })
                .map(function(r) {
                    return {
                        connector_id: r.cnntr_id,
                        type: r.cnntr_typ_cd,
                        name: r.cnntr_nm_tx,
                        power: r.pwr_tx,
                        is_available: r.is_avlbl_in === 1
                    };
                });

            const available = connectors.find(function(c) { return c.is_available; }) || connectors[0] || null;
            if (!available) {
                auditScan('no_connectors', head.mchn_id, { ocpp_id: head.ocpp_id_tx || null });
                return res.status(std.message["BAD_REQUEST"].code).json({
                    status: std.message["BAD_REQUEST"].code, message: 'This charger has no connectors configured', data: null
                });
            }

            const online = isChargerOnline(head.ocpp_id_tx);
            auditScan(online ? 'ok' : 'offline', head.mchn_id, {
                ocpp_id: head.ocpp_id_tx || null, station_id: head.sttn_id, online, configured: !!head.ocpp_id_tx,
            });

            return df.formatSucessRes(req, res, {
                machine: {
                    machine_id: head.mchn_id,
                    name: head.mchn_nm_tx,
                    ocpp_id: head.ocpp_id_tx || null,
                    machine_type: head.mchn_typ_cd,
                    power: head.max_pwr_tx,
                    status: head.mchn_sttus_cd,
                    configured: !!head.ocpp_id_tx,
                    // live connectivity from the OCPP WebSocket registry (real-time,
                    // authoritative — not the cached DB status)
                    online: online
                },
                station: {
                    station_id: head.sttn_id,
                    name: head.sttn_nm_tx,
                    code: head.sttn_cd,
                    address: head.addr_tx,
                    price_per_kwh: parseFloat(head.prce_per_kwh_amt) || 0
                },
                connector: available,
                connectors: connectors
            }, cntxtDtls, fnm, {});
        })
        .catch(function(error) {
            console.error('[sessionCtrl] scanQr error:', error);
            return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
        });
};

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

    // Defense-in-depth: refuse to start if the charger isn't connected. The app
    // sends the charger's OCPP id as `qr_code`; only enforce when it's a real
    // OCPP id so other callers aren't affected.
    if (qr_code && extractOcppId(qr_code) && !isChargerOnline(qr_code)) {
        return res.status(std.message["BAD_REQUEST"].code).json({
            status: std.message["BAD_REQUEST"].code,
            message: 'This charger is offline. Please try again once it is back online.',
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

                                // Prepay via the LEDGER: DEBIT customer wallet -> CREDIT escrow.
                                // This keeps the customer's ledger wallet + legacy wllt_lst_t
                                // accurate and lets us split owner/platform at stop.
                                const _ctx = audit.reqCtx(req);
                                return ledgerService.chargingHold({
                                    userId: userId,
                                    sessionId: sessionId,
                                    amount: totalAmountToDeduct,
                                    audit: { actnCd: 'charging_hold', userId: userId, ip: _ctx.ip, userAgent: _ctx.userAgent },
                                })
                                .then(function() {
                                    return sessionMdl.updatePaymentStatusMdl({ sessionId: sessionId, status: 'paid', transactionId: null });
                                })
                                .then(function() {
                                    return sessionMdl.startSessionMdl({ sessionId: sessionId });
                                })
                                .then(function() {
                                    // store prepaid amount in ttl_cst_amt (read back as the hold at stop)
                                    return sessionMdl.updateProgressMdl({ sessionId: sessionId, progress: 0, energyConsumed: 0, currentCost: totalAmountToDeduct });
                                })
                                .then(function() {
                                    return stationMdl.getConnectorByIdMdl({ connectorId: connector_id })
                                        .then(function(connectorResults) {
                                            const connector = (connectorResults && connectorResults.length > 0) ? connectorResults[0] : null;
                                            audit.writeAudit({
                                                userId: _ctx.userId, action: 'session_start', entityType: 'session', entityId: sessionId,
                                                newVal: { stationId: station_id, connectorId: connector_id, sessionCode: sessionCode, walletId: wallet.wllt_id },
                                                ip: _ctx.ip, userAgent: _ctx.userAgent
                                            });
                                            audit.writeAudit({
                                                userId: _ctx.userId, action: 'session_payment', entityType: 'session', entityId: sessionId,
                                                newVal: { amount: totalAmountToDeduct, via: 'ledger_hold' }, ip: _ctx.ip, userAgent: _ctx.userAgent
                                            });
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
            const price = parseFloat(session.prce_per_kwh_amt) || 0;
            const actualTotalCost = Math.round(energyConsumed * price * 100) / 100;
            const prepaidAmount = parseFloat(session.ttl_cst_amt) || 0;
            const _ctx = audit.reqCtx(req);

            // Resolve the station owner (vendor), finalize the session, then SETTLE
            // via the LEDGER: split the consumed amount between vendor (owner %) and
            // DJT (platform %), and refund the unused hold to the customer. All
            // double-entry, mirrored to customer + vendor wallets, and audited.
            return stationMdl.getStationByIdMdl({ stationId: session.sttn_id })
                .then(function(stnRows) {
                    const ownerUserId = (stnRows && stnRows[0] && stnRows[0].ownr_usr_id) ? stnRows[0].ownr_usr_id : null;
                    return sessionMdl.stopSessionMdl({ sessionId: session_id, energyConsumed: energyConsumed, totalCost: actualTotalCost })
                        .then(function() {
                            return ledgerService.chargingSettle({
                                userId: userId, sessionId: session_id, stationId: session.sttn_id, ownerUserId: ownerUserId,
                                holdAmount: prepaidAmount, consumedAmount: actualTotalCost,
                                audit: { actnCd: 'charging_payment', userId: userId, ip: _ctx.ip, userAgent: _ctx.userAgent },
                            });
                        })
                        .then(function(settle) {
                            return sessionMdl.updatePaymentStatusMdl({ sessionId: session_id, status: 'paid', transactionId: null })
                                .then(function() {
                                    audit.writeAudit({
                                        userId: _ctx.userId, action: 'session_stop', entityType: 'session', entityId: session_id,
                                        newVal: { energy: energyConsumed, cost: settle.consumedAmount, refund: settle.refundAmount, ownerUserId: ownerUserId, commission: settle.commission },
                                        ip: _ctx.ip, userAgent: _ctx.userAgent
                                    });
                                    return df.formatSucessRes(req, res, {
                                        session_id: session_id,
                                        duration_minutes: session.durn_mnts_nbr || 0,
                                        energy_consumed: energyConsumed,
                                        prepaid_amount: prepaidAmount,
                                        actual_cost: settle.consumedAmount,
                                        refund_amount: settle.refundAmount,
                                        total_cost: settle.consumedAmount,
                                        status: 'completed',
                                        end_time: new Date().toISOString()
                                    }, cntxtDtls, fnm, { message: 'Charging session stopped' });
                                });
                        });
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
