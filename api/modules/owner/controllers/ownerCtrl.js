/**
 * Owner Controller
 * EV station owner operations: create/list stations, add machines & connectors.
 * All routes are guarded by verifyToken + isOwner.
 */

const ownerMdl = require('../models/ownerMdl');
const std = require(appRoot + '/utils/standardMessages');
const df = require(appRoot + '/utils/dateFormatUtil');
const config = require(appRoot + '/config/config');
const qrUtil = require(appRoot + '/utils/qrUtil');
const audit = require(appRoot + '/utils/auditUtil');
const cntxtDtls = "ownerCtrl";

// Generate a reasonably-unique station code, e.g. DJT-LZ4F9K2
function genStationCode() {
    return 'DJT-' + Date.now().toString(36).toUpperCase().slice(-6) +
        Math.floor(Math.random() * 90 + 10);
}

// Auto-generate an OCPP ChargePoint identity, e.g. DJT-12-CP3-K7Q
function genOcppId(stationId, seq) {
    const rand = Math.random().toString(36).toUpperCase().slice(2, 5);
    return `DJT-${stationId}-CP${seq}-${rand}`;
}

// Build the WebSocket URL a charge point uses to connect to the CSMS.
function ocppWsUrl(ocppId) {
    const base = (config.ocpp && config.ocpp.wsBaseUrl) || `ws://localhost:${config.port}`;
    return `${base.replace(/\/$/, '')}/ocpp/${encodeURIComponent(ocppId)}`;
}

function badRequest(res, message) {
    return res.status(std.message["BAD_REQUEST"].code).json({
        status: std.message["BAD_REQUEST"].code, message, data: null
    });
}

function notFound(res, message) {
    return res.status(std.message["NOT_FOUND"].code).json({
        status: std.message["NOT_FOUND"].code, message, data: null
    });
}

function mapStation(s) {
    return {
        station_id: s.sttn_id,
        owner_id: s.ownr_usr_id,
        approval_status: s.aprvl_sttus_cd,
        name: s.sttn_nm_tx,
        code: s.sttn_cd,
        address: s.addr_tx,
        city: s.cty_tx,
        state: s.stte_tx,
        postal_code: s.pstl_cd_tx,
        latitude: s.ltde_nbr !== null ? parseFloat(s.ltde_nbr) : null,
        longitude: s.lngtde_nbr !== null ? parseFloat(s.lngtde_nbr) : null,
        price_per_kwh: parseFloat(s.prce_per_kwh_amt || 0),
        total_chargers: s.ttl_chrgrs_nbr || 0,
        available_chargers: s.avlbl_chrgrs_nbr || 0,
        is_fast_charging: s.is_fst_chrgng_in === 1,
        power: s.pwr_tx,
        operator_name: s.oprtr_nm_tx,
        contact_number: s.cntct_nbr_tx,
        rating: parseFloat(s.rtng_nbr || 0),
        machine_count: s.machine_count !== undefined ? Number(s.machine_count) : undefined,
        connector_count: s.connector_count !== undefined ? Number(s.connector_count) : undefined,
        created_at: s.i_ts
    };
}

function mapMachine(m) {
    return {
        machine_id: m.mchn_id,
        station_id: m.sttn_id,
        name: m.mchn_nm_tx,
        serial_no: m.mchn_srl_no_tx,
        ocpp_id: m.ocpp_id_tx,
        ws_url: m.ocpp_id_tx ? ocppWsUrl(m.ocpp_id_tx) : null,
        machine_type: m.mchn_typ_cd,
        power_id: m.mchn_pwr_id || null,
        power_code: m.pwr_cd || null,
        power_label: m.pwr_lbl_tx || (m.max_pwr_tx ? `${m.mchn_typ_cd} ${m.max_pwr_tx}` : null),
        kw: m.kw_nbr !== undefined && m.kw_nbr !== null ? parseFloat(m.kw_nbr) : null,
        max_power: m.max_pwr_tx,
        total_connectors: m.ttl_cnntrs_nbr,
        status: m.sttus_cd,
        last_heartbeat: m.lst_hb_ts || null,
        created_at: m.i_ts
    };
}

function mapConnector(c) {
    return {
        connector_id: c.cnntr_id,
        station_id: c.sttn_id,
        machine_id: c.mchn_id,
        type: c.cnntr_typ_cd,
        name: c.cnntr_nm_tx,
        power: c.pwr_tx,
        is_available: c.is_avlbl_in === 1
    };
}

/*****************************************************************************
* Function      : getDashboard
* Description   : Owner summary counts
******************************************************************************/
exports.getDashboard = function(req, res) {
    const fnm = "getDashboard";
    const ownerId = req.user.userId;

    ownerMdl.getOwnerDashboardMdl({ ownerId })
        .then(function(rows) {
            const r = (rows && rows[0]) || {};
            return df.formatSucessRes(req, res, {
                total_stations: Number(r.total_stations || 0),
                total_machines: Number(r.total_machines || 0),
                total_connectors: Number(r.total_connectors || 0),
                available_machines: Number(r.available_machines || 0)
            }, cntxtDtls, fnm, {});
        })
        .catch(function(error) {
            console.error('[ownerCtrl] getDashboard error:', error);
            return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
        });
};

/*****************************************************************************
* Function      : getAnalytics
* Description   : Rich owner dashboard analytics — today vs yesterday revenue &
*                 consumption (+ hourly series), this-month totals, station
*                 status breakdown, and recent transactions.
******************************************************************************/
exports.getAnalytics = function(req, res) {
    const fnm = "getAnalytics";
    const ownerId = req.user.userId;

    // Day-over-day % change, with sane handling of a zero baseline
    function trend(curr, prev) {
        curr = Number(curr) || 0; prev = Number(prev) || 0;
        if (prev === 0) return curr > 0 ? 100 : 0;
        return Math.round(((curr - prev) / prev) * 1000) / 10;
    }

    Promise.all([
        ownerMdl.getOwnerTodayTotalsMdl({ ownerId }),
        ownerMdl.getOwnerMonthTotalsMdl({ ownerId }),
        ownerMdl.getOwnerHourlySeriesMdl({ ownerId }),
        ownerMdl.getOwnerStationStatusMdl({ ownerId }),
        ownerMdl.getOwnerRecentTxnsMdl({ ownerId, limit: 8 }),
        ownerMdl.getOwnerCountTrendsMdl({ ownerId }),
        ownerMdl.getOwnerDashboardMdl({ ownerId })
    ]).then(function(results) {
        const t = (results[0] && results[0][0]) || {};
        const mo = (results[1] && results[1][0]) || {};
        const hourlyRows = results[2] || [];
        const statusRows = results[3] || [];
        const recentRows = results[4] || [];
        const tr = (results[5] && results[5][0]) || {};
        const counts = (results[6] && results[6][0]) || {};

        const todayRevenue = Number(t.today_revenue) || 0;
        const todayEnergy = Number(t.today_energy) || 0;
        const monthRevenue = Number(mo.month_revenue) || 0;
        const monthEnergy = Number(mo.month_energy) || 0;

        // Fill 24 hourly buckets (00:00 .. 23:00) from the sparse query result
        const byHour = {};
        hourlyRows.forEach(function(r) { byHour[Number(r.hr)] = r; });
        const hourly = [];
        for (let h = 0; h < 24; h++) {
            const row = byHour[h];
            hourly.push({
                hour: (h < 10 ? '0' + h : '' + h) + ':00',
                revenue: row ? Number(row.revenue) || 0 : 0,
                consumption: row ? Number(row.energy) || 0 : 0
            });
        }

        // Classify each station's operational status from its machine rollup
        const stationStatus = { active: 0, offline: 0, faulted: 0, maintenance: 0, total: statusRows.length };
        statusRows.forEach(function(s) {
            if (Number(s.faulted) > 0) stationStatus.faulted++;
            else if (Number(s.maintenance) > 0) stationStatus.maintenance++;
            else if (Number(s.active) > 0 && s.aprvl_sttus_cd === 'active') stationStatus.active++;
            else stationStatus.offline++;
        });

        const totalStations = Number(counts.total_stations) || 0;
        const totalMachines = Number(counts.total_machines) || 0;
        const totalConnectors = Number(counts.total_connectors) || 0;
        const availableMachines = Number(counts.available_machines) || 0;

        const recent_transactions = recentRows.map(function(r) {
            return {
                code: r.sssn_cd,
                station: r.sttn_nm_tx,
                connector: r.cnntr_nm_tx || null,
                energy_kwh: Number(r.enrgy_cnsmd_kwh) || 0,
                duration_min: r.durn_mnts_nbr != null ? Number(r.durn_mnts_nbr) : null,
                cost: Number(r.ttl_cst_amt) || 0,
                status: r.sttus_cd
            };
        });

        return df.formatSucessRes(req, res, {
            cards: {
                stations: { value: totalStations, trend_pct: trend(totalStations, tr.stations_prev) },
                machines: { value: totalMachines, trend_pct: trend(totalMachines, tr.machines_prev) },
                connectors: { value: totalConnectors, trend_pct: trend(totalConnectors, tr.connectors_prev) },
                available: { value: availableMachines, trend_pct: totalMachines > 0 ? Math.round((availableMachines / totalMachines) * 100) : 0 }
            },
            today: {
                revenue: todayRevenue,
                consumption: todayEnergy,
                transactions: Number(t.today_txns) || 0,
                revenue_trend_pct: trend(todayRevenue, t.yest_revenue),
                consumption_trend_pct: trend(todayEnergy, t.yest_energy)
            },
            month: {
                revenue: monthRevenue,
                consumption: monthEnergy,
                avg_revenue_per_kwh: monthEnergy > 0 ? Math.round((monthRevenue / monthEnergy) * 100) / 100 : 0,
                transactions_today: Number(t.today_txns) || 0
            },
            charts: { hourly: hourly },
            station_status: stationStatus,
            recent_transactions: recent_transactions
        }, cntxtDtls, fnm, {});
    }).catch(function(error) {
        console.error('[ownerCtrl] getAnalytics error:', error);
        return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
    });
};

/*****************************************************************************
* Function      : getStationAnalytics
* Description   : Per-station summary cards (no charts): today vs yesterday,
*                 this-month totals, lifetime totals, and inventory. Ownership
*                 is enforced before any metric is returned.
******************************************************************************/
exports.getStationAnalytics = function(req, res) {
    const fnm = "getStationAnalytics";
    const ownerId = req.user.userId;
    const stationId = parseInt(req.params.stationId);
    if (!stationId) return badRequest(res, 'Station ID is required');

    function trend(curr, prev) {
        curr = Number(curr) || 0; prev = Number(prev) || 0;
        if (prev === 0) return curr > 0 ? 100 : 0;
        return Math.round(((curr - prev) / prev) * 1000) / 10;
    }

    ownerMdl.getOwnedStationMdl({ ownerId, stationId })
        .then(function(rows) {
            if (!rows || rows.length === 0) return notFound(res, 'Station not found');

            return Promise.all([
                ownerMdl.getStationTodayTotalsMdl({ stationId }),
                ownerMdl.getStationMonthTotalsMdl({ stationId }),
                ownerMdl.getStationLifetimeMdl({ stationId }),
                ownerMdl.getStationInventoryMdl({ stationId })
            ]).then(function(results) {
                const t = (results[0] && results[0][0]) || {};
                const mo = (results[1] && results[1][0]) || {};
                const lt = (results[2] && results[2][0]) || {};
                const inv = (results[3] && results[3][0]) || {};

                const todayRevenue = Number(t.today_revenue) || 0;
                const todayEnergy = Number(t.today_energy) || 0;
                const monthRevenue = Number(mo.month_revenue) || 0;
                const monthEnergy = Number(mo.month_energy) || 0;

                return df.formatSucessRes(req, res, {
                    today: {
                        revenue: todayRevenue,
                        consumption: todayEnergy,
                        sessions: Number(t.today_sessions) || 0,
                        revenue_trend_pct: trend(todayRevenue, t.yest_revenue),
                        consumption_trend_pct: trend(todayEnergy, t.yest_energy)
                    },
                    month: {
                        revenue: monthRevenue,
                        consumption: monthEnergy,
                        sessions: Number(mo.month_sessions) || 0,
                        avg_revenue_per_kwh: monthEnergy > 0 ? Math.round((monthRevenue / monthEnergy) * 100) / 100 : 0
                    },
                    lifetime: {
                        revenue: Number(lt.total_revenue) || 0,
                        consumption: Number(lt.total_energy) || 0,
                        sessions: Number(lt.total_sessions) || 0,
                        avg_duration_min: Math.round(Number(lt.avg_duration) || 0)
                    },
                    inventory: {
                        machines: Number(inv.machines) || 0,
                        available_machines: Number(inv.available_machines) || 0,
                        connectors: Number(inv.connectors) || 0
                    }
                }, cntxtDtls, fnm, {});
            });
        })
        .catch(function(error) {
            console.error('[ownerCtrl] getStationAnalytics error:', error);
            return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
        });
};

/*****************************************************************************
* Function      : getMachineProfile
* Description   : One machine's full profile — details, connectors, and summary
*                 cards (today vs yesterday, this-month, lifetime). Metrics are
*                 scoped to the machine via its connectors. Ownership enforced.
******************************************************************************/
exports.getMachineProfile = function(req, res) {
    const fnm = "getMachineProfile";
    const ownerId = req.user.userId;
    const machineId = parseInt(req.params.machineId);
    if (!machineId) return badRequest(res, 'Machine ID is required');

    function trend(curr, prev) {
        curr = Number(curr) || 0; prev = Number(prev) || 0;
        if (prev === 0) return curr > 0 ? 100 : 0;
        return Math.round(((curr - prev) / prev) * 1000) / 10;
    }

    ownerMdl.getOwnedMachineMdl({ ownerId, machineId })
        .then(function(rows) {
            const m = rows && rows[0];
            if (!m) return notFound(res, 'Machine not found');

            return Promise.all([
                ownerMdl.getConnectorsByMachineMdl({ machineId }),
                ownerMdl.getMachineTodayTotalsMdl({ machineId }),
                ownerMdl.getMachineMonthTotalsMdl({ machineId }),
                ownerMdl.getMachineLifetimeMdl({ machineId })
            ]).then(function(results) {
                const connectors = (results[0] || []).map(mapConnector);
                const t = (results[1] && results[1][0]) || {};
                const mo = (results[2] && results[2][0]) || {};
                const lt = (results[3] && results[3][0]) || {};

                const todayRevenue = Number(t.today_revenue) || 0;
                const todayEnergy = Number(t.today_energy) || 0;
                const monthRevenue = Number(mo.month_revenue) || 0;
                const monthEnergy = Number(mo.month_energy) || 0;

                return df.formatSucessRes(req, res, {
                    machine: {
                        machine_id: m.mchn_id,
                        station_id: m.sttn_id,
                        station_name: m.sttn_nm_tx,
                        name: m.mchn_nm_tx,
                        serial_no: m.mchn_srl_no_tx,
                        ocpp_id: m.ocpp_id_tx,
                        ws_url: m.ocpp_id_tx ? ocppWsUrl(m.ocpp_id_tx) : null,
                        machine_type: m.mchn_typ_cd,
                        power_code: m.pwr_cd || null,
                        power_label: m.pwr_lbl_tx || (m.max_pwr_tx ? `${m.mchn_typ_cd} ${m.max_pwr_tx}` : null),
                        kw: m.kw_nbr != null ? parseFloat(m.kw_nbr) : null,
                        max_power: m.max_pwr_tx,
                        total_connectors: m.ttl_cnntrs_nbr,
                        status: m.sttus_cd,
                        last_heartbeat: m.lst_hb_ts || null,
                        created_at: m.i_ts
                    },
                    connectors: connectors,
                    analytics: {
                        today: {
                            revenue: todayRevenue,
                            consumption: todayEnergy,
                            sessions: Number(t.today_sessions) || 0,
                            revenue_trend_pct: trend(todayRevenue, t.yest_revenue),
                            consumption_trend_pct: trend(todayEnergy, t.yest_energy)
                        },
                        month: {
                            revenue: monthRevenue,
                            consumption: monthEnergy,
                            sessions: Number(mo.month_sessions) || 0,
                            avg_revenue_per_kwh: monthEnergy > 0 ? Math.round((monthRevenue / monthEnergy) * 100) / 100 : 0
                        },
                        lifetime: {
                            revenue: Number(lt.total_revenue) || 0,
                            consumption: Number(lt.total_energy) || 0,
                            sessions: Number(lt.total_sessions) || 0,
                            avg_duration_min: Math.round(Number(lt.avg_duration) || 0),
                            last_session: lt.last_session_ts || null
                        }
                    }
                }, cntxtDtls, fnm, {});
            });
        })
        .catch(function(error) {
            console.error('[ownerCtrl] getMachineProfile error:', error);
            return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
        });
};

/*****************************************************************************
* Function      : getMachineQr
* Description   : Build the signed, app-only QR token for a machine. The token
*                 embeds OCPP id, WebSocket URL, price and station/machine
*                 details; the app renders & downloads the QR from it. Ownership
*                 is enforced.
******************************************************************************/
exports.getMachineQr = function(req, res) {
    const fnm = "getMachineQr";
    const ownerId = req.user.userId;
    const machineId = parseInt(req.params.machineId);
    if (!machineId) return badRequest(res, 'Machine ID is required');

    ownerMdl.getOwnedMachineMdl({ ownerId, machineId })
        .then(function(rows) {
            const m = rows && rows[0];
            if (!m) return notFound(res, 'Machine not found');

            const wsUrl = m.ocpp_id_tx ? ocppWsUrl(m.ocpp_id_tx) : null;
            const powerLabel = m.pwr_lbl_tx || (m.max_pwr_tx ? `${m.mchn_typ_cd} ${m.max_pwr_tx}` : null);
            const price = parseFloat(m.prce_per_kwh_amt) || 0;

            // Payload encoded inside the QR (verified server-side on scan)
            const payload = {
                v: 1,
                t: 'machine',
                mid: m.mchn_id,
                sid: m.sttn_id,
                ocpp: m.ocpp_id_tx || null,
                ws: wsUrl,
                price: price,
                st: m.sttn_nm_tx,
                mn: m.mchn_nm_tx,
                typ: m.mchn_typ_cd,
                pwr: powerLabel
            };

            const actx = audit.reqCtx(req);
            audit.writeAudit({
                userId: actx.userId, action: 'qr_generate', entityType: 'machine', entityId: m.mchn_id,
                newVal: { ocpp_id: m.ocpp_id_tx || null, station_id: m.sttn_id, configured: !!m.ocpp_id_tx },
                ip: actx.ip, userAgent: actx.userAgent,
            });

            return df.formatSucessRes(req, res, {
                token: qrUtil.encode(payload),
                machine: {
                    machine_id: m.mchn_id,
                    name: m.mchn_nm_tx,
                    station_name: m.sttn_nm_tx,
                    ocpp_id: m.ocpp_id_tx || null,
                    ws_url: wsUrl,
                    machine_type: m.mchn_typ_cd,
                    power_label: powerLabel,
                    price_per_kwh: price,
                    configured: !!m.ocpp_id_tx
                }
            }, cntxtDtls, fnm, {});
        })
        .catch(function(error) {
            console.error('[ownerCtrl] getMachineQr error:', error);
            return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
        });
};

/*****************************************************************************
* Function      : getTransactions
* Description   : Full transaction (session) list across the owner's stations.
******************************************************************************/
exports.getTransactions = function(req, res) {
    const fnm = "getTransactions";
    const ownerId = req.user.userId;
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 200);

    ownerMdl.getOwnerTransactionsMdl({ ownerId, limit })
        .then(function(rows) {
            const transactions = (rows || []).map(function(r) {
                return {
                    code: r.sssn_cd,
                    station: r.sttn_nm_tx,
                    connector: r.cnntr_nm_tx || null,
                    customer: r.usr_nm || null,
                    energy_kwh: Number(r.enrgy_cnsmd_kwh) || 0,
                    duration_min: r.durn_mnts_nbr != null ? Number(r.durn_mnts_nbr) : null,
                    cost: Number(r.ttl_cst_amt) || 0,
                    status: r.sttus_cd,
                    payment_status: r.pymnt_sttus_cd,
                    date: r.strt_ts || r.i_ts
                };
            });
            return df.formatSucessRes(req, res, { transactions: transactions }, cntxtDtls, fnm, {});
        })
        .catch(function(error) {
            console.error('[ownerCtrl] getTransactions error:', error);
            return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
        });
};

/*****************************************************************************
* Function      : getMyStations
******************************************************************************/
exports.getMyStations = function(req, res) {
    const fnm = "getMyStations";
    const ownerId = req.user.userId;

    ownerMdl.getStationsByOwnerMdl({ ownerId })
        .then(function(stations) {
            const list = (stations || []).map(mapStation);
            return df.formatSucessRes(req, res, { stations: list }, cntxtDtls, fnm, {});
        })
        .catch(function(error) {
            console.error('[ownerCtrl] getMyStations error:', error);
            return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
        });
};

/*****************************************************************************
* Function      : createStation
* Description   : Create a station owned by the logged-in owner.
*                 Latitude/longitude are REQUIRED (captured on the map).
******************************************************************************/
exports.createStation = function(req, res) {
    const fnm = "createStation";
    const data = req.body.data ? req.body.data : req.body;
    const ownerId = req.user.userId;

    const name = (data.name || '').trim();
    const address = (data.address || '').trim();
    const latitude = data.latitude;
    const longitude = data.longitude;

    if (!name) return badRequest(res, 'Station name is required');
    if (!address) return badRequest(res, 'Station address is required');

    // Location is mandatory — the UI shows a warning if not captured.
    if (latitude === undefined || latitude === null || latitude === '' ||
        longitude === undefined || longitude === null || longitude === '') {
        return badRequest(res, 'Please capture the station location (latitude & longitude) on the map');
    }
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return badRequest(res, 'Invalid location coordinates');
    }

    const payload = {
        ownerId,
        code: genStationCode(),
        name,
        address,
        city: data.city || null,
        state: data.state || null,
        postalCode: data.postal_code || null,
        latitude: lat,
        longitude: lng,
        pricePerKwh: data.price_per_kwh || 0,
        totalChargers: 0,
        availableChargers: 0,
        isFastCharging: !!data.is_fast_charging,
        power: data.power || null,
        operatorName: data.operator_name || null,
        contactNumber: data.contact_number || null
    };

    ownerMdl.createStationMdl(payload)
        .then(function(result) {
            if (!result || !result.insertId) {
                return res.status(std.message["INTERNAL_ERROR"].code).json({
                    status: std.message["INTERNAL_ERROR"].code,
                    message: 'Failed to create station', data: null
                });
            }
            const actx = audit.reqCtx(req);
            audit.writeAudit({
                userId: actx.userId, action: 'station_create',
                entityType: 'station', entityId: result.insertId,
                newVal: { name: payload.name, city: payload.city, code: payload.code, address: payload.address },
                ip: actx.ip, userAgent: actx.userAgent
            });
            return ownerMdl.getOwnedStationMdl({ ownerId, stationId: result.insertId })
                .then(function(rows) {
                    return df.formatSucessRes(req, res,
                        { station: rows && rows[0] ? mapStation(rows[0]) : { station_id: result.insertId } },
                        cntxtDtls, fnm, { message: 'Station created successfully' });
                });
        })
        .catch(function(error) {
            console.error('[ownerCtrl] createStation error:', error);
            return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
        });
};

/*****************************************************************************
* Function      : getStationDetail
* Description   : Owned station with its machines + connectors
******************************************************************************/
exports.getStationDetail = function(req, res) {
    const fnm = "getStationDetail";
    const ownerId = req.user.userId;
    const stationId = parseInt(req.params.stationId);

    if (!stationId) return badRequest(res, 'Station ID is required');

    ownerMdl.getOwnedStationMdl({ ownerId, stationId })
        .then(function(rows) {
            if (!rows || rows.length === 0) return notFound(res, 'Station not found');
            const station = mapStation(rows[0]);

            return ownerMdl.getMachinesByStationMdl({ stationId })
                .then(function(machines) {
                    machines = machines || [];
                    return Promise.all(machines.map(function(m) {
                        return ownerMdl.getConnectorsByMachineMdl({ machineId: m.mchn_id })
                            .then(function(conns) {
                                const machine = mapMachine(m);
                                machine.connectors = (conns || []).map(mapConnector);
                                return machine;
                            });
                    }));
                })
                .then(function(machinesWithConns) {
                    station.machines = machinesWithConns;
                    return df.formatSucessRes(req, res, { station }, cntxtDtls, fnm, {});
                });
        })
        .catch(function(error) {
            console.error('[ownerCtrl] getStationDetail error:', error);
            return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
        });
};

/*****************************************************************************
* Function      : updateStation
******************************************************************************/
exports.updateStation = function(req, res) {
    const fnm = "updateStation";
    const data = req.body.data ? req.body.data : req.body;
    const ownerId = req.user.userId;
    const stationId = parseInt(req.params.stationId);

    if (!stationId) return badRequest(res, 'Station ID is required');

    ownerMdl.getOwnedStationMdl({ ownerId, stationId })
        .then(function(rows) {
            if (!rows || rows.length === 0) return notFound(res, 'Station not found');
            return ownerMdl.updateStationMdl({
                ownerId, stationId,
                name: data.name, address: data.address, city: data.city, state: data.state,
                latitude: data.latitude, longitude: data.longitude,
                pricePerKwh: data.price_per_kwh, isFastCharging: data.is_fast_charging,
                power: data.power, operatorName: data.operator_name, contactNumber: data.contact_number
            }).then(function() {
                const actx = audit.reqCtx(req);
                audit.writeAudit({
                    userId: actx.userId, action: 'station_update',
                    entityType: 'station', entityId: stationId,
                    newVal: {
                        name: data.name, address: data.address, city: data.city, state: data.state,
                        latitude: data.latitude, longitude: data.longitude,
                        price_per_kwh: data.price_per_kwh, is_fast_charging: data.is_fast_charging,
                        power: data.power, operator_name: data.operator_name, contact_number: data.contact_number
                    },
                    ip: actx.ip, userAgent: actx.userAgent
                });
                return ownerMdl.getOwnedStationMdl({ ownerId, stationId })
                    .then(function(updated) {
                        return df.formatSucessRes(req, res, { station: mapStation(updated[0]) },
                            cntxtDtls, fnm, { message: 'Station updated' });
                    });
            });
        })
        .catch(function(error) {
            console.error('[ownerCtrl] updateStation error:', error);
            return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
        });
};

/*****************************************************************************
* Function      : getStationMachines
******************************************************************************/
exports.getStationMachines = function(req, res) {
    const fnm = "getStationMachines";
    const ownerId = req.user.userId;
    const stationId = parseInt(req.params.stationId);

    if (!stationId) return badRequest(res, 'Station ID is required');

    ownerMdl.getOwnedStationMdl({ ownerId, stationId })
        .then(function(rows) {
            if (!rows || rows.length === 0) return notFound(res, 'Station not found');
            return ownerMdl.getMachinesByStationMdl({ stationId })
                .then(function(machines) {
                    machines = machines || [];
                    return Promise.all(machines.map(function(m) {
                        return ownerMdl.getConnectorsByMachineMdl({ machineId: m.mchn_id })
                            .then(function(conns) {
                                const machine = mapMachine(m);
                                machine.connectors = (conns || []).map(mapConnector);
                                return machine;
                            });
                    }));
                })
                .then(function(list) {
                    return df.formatSucessRes(req, res, { machines: list }, cntxtDtls, fnm, {});
                });
        })
        .catch(function(error) {
            console.error('[ownerCtrl] getStationMachines error:', error);
            return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
        });
};

/*****************************************************************************
* Function      : getPowerOptions
* Description   : Master list of selectable power tiers (AC/DC/DCS)
******************************************************************************/
exports.getPowerOptions = function(req, res) {
    const fnm = "getPowerOptions";
    ownerMdl.getPowerOptionsMdl()
        .then(function(rows) {
            const options = (rows || []).map(function(p) {
                return {
                    power_id: p.mchn_pwr_id,
                    code: p.pwr_cd,
                    label: p.pwr_lbl_tx,
                    machine_type: p.mchn_typ_cd,
                    kw: parseFloat(p.kw_nbr),
                    default_connector_type: p.dflt_cnntr_typ_cd
                };
            });
            return df.formatSucessRes(req, res, { power_options: options }, cntxtDtls, fnm, {});
        })
        .catch(function(error) {
            console.error('[ownerCtrl] getPowerOptions error:', error);
            return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
        });
};

/*****************************************************************************
* Function      : addMachine
* Description   : Add a charger. OCPP id + WS URL are auto-generated, machine type
*                 and power come from the selected power tier, and N default
*                 connectors (2) are created automatically.
******************************************************************************/
exports.addMachine = function(req, res) {
    const fnm = "addMachine";
    const data = req.body.data ? req.body.data : req.body;
    const ownerId = req.user.userId;
    const stationId = parseInt(req.params.stationId);

    if (!stationId) return badRequest(res, 'Station ID is required');
    const name = (data.name || '').trim();
    if (!name) return badRequest(res, 'Machine name is required');

    const powerId = parseInt(data.mchn_pwr_id || data.power_id);
    if (!powerId) return badRequest(res, 'Please select a power rating');

    // default 2 connectors, clamp 1..6
    const connectorCount = Math.min(Math.max(parseInt(data.connector_count) || 2, 1), 6);

    ownerMdl.getOwnedStationMdl({ ownerId, stationId })
        .then(function(rows) {
            if (!rows || rows.length === 0) return notFound(res, 'Station not found');

            return ownerMdl.getPowerByIdMdl(powerId).then(function(pRows) {
                const power = pRows && pRows[0];
                if (!power) return badRequest(res, 'Invalid power option');

                const machineType = power.mchn_typ_cd;            // AC | DC | DCS
                const maxPower = `${parseFloat(power.kw_nbr)}kW`;  // e.g. 60kW
                const connectorType = power.dflt_cnntr_typ_cd || (machineType === 'AC' ? 'Type2' : 'CCS2');

                // OCPP id sequence = existing machine count + 1
                return ownerMdl.getMachineCountMdl(stationId).then(function(cRows) {
                    const seq = (cRows && cRows[0] ? Number(cRows[0].cnt) : 0) + 1;
                    const ocppId = genOcppId(stationId, seq);

                    return ownerMdl.createMachineMdl({
                        stationId, name,
                        serialNo: data.serial_no || null,
                        ocppId,
                        machineType,
                        powerId,
                        maxPower,
                        totalConnectors: connectorCount,
                        status: 'available'
                    }).then(function(result) {
                        const machineId = result.insertId;

                        const actx = audit.reqCtx(req);
                        audit.writeAudit({
                            userId: actx.userId, action: 'machine_create',
                            entityType: 'machine', entityId: machineId,
                            newVal: { name: name, ocppId: ocppId, machineType: machineType, stationId: stationId },
                            ip: actx.ip, userAgent: actx.userAgent
                        });

                        // auto-create the default connectors
                        const connPromises = [];
                        for (let i = 1; i <= connectorCount; i++) {
                            connPromises.push(ownerMdl.createConnectorMdl({
                                stationId, machineId,
                                connectorType,
                                name: `Connector ${i}`,
                                power: maxPower
                            }).then(function(cResult) {
                                audit.writeAudit({
                                    userId: actx.userId, action: 'connector_create',
                                    entityType: 'connector', entityId: cResult && cResult.insertId,
                                    newVal: { type: connectorType, machineId: machineId },
                                    ip: actx.ip, userAgent: actx.userAgent
                                });
                                return cResult;
                            }));
                        }

                        return Promise.all(connPromises)
                            .then(function() { return ownerMdl.recalcStationCountersMdl({ stationId }); })
                            .then(function() {
                                return df.formatSucessRes(req, res, {
                                    machine_id: machineId,
                                    ocpp_id: ocppId,
                                    ws_url: ocppWsUrl(ocppId),
                                    machine_type: machineType,
                                    max_power: maxPower,
                                    power_label: power.pwr_lbl_tx,
                                    connector_type: connectorType,
                                    connectors_created: connectorCount
                                }, cntxtDtls, fnm, { message: `Machine added with ${connectorCount} connectors` });
                            });
                    });
                });
            });
        })
        .catch(function(error) {
            console.error('[ownerCtrl] addMachine error:', error);
            return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
        });
};

/*****************************************************************************
* Function      : updateMachine
******************************************************************************/
exports.updateMachine = function(req, res) {
    const fnm = "updateMachine";
    const data = req.body.data ? req.body.data : req.body;
    const ownerId = req.user.userId;
    const machineId = parseInt(req.params.machineId);

    if (!machineId) return badRequest(res, 'Machine ID is required');

    ownerMdl.getOwnedMachineMdl({ ownerId, machineId })
        .then(function(rows) {
            if (!rows || rows.length === 0) return notFound(res, 'Machine not found');
            const stationId = rows[0].sttn_id;
            return ownerMdl.updateMachineMdl({
                machineId,
                name: data.name, serialNo: data.serial_no, ocppId: data.ocpp_id,
                machineType: data.machine_type, maxPower: data.max_power, status: data.status
            }).then(function() {
                const actx = audit.reqCtx(req);
                audit.writeAudit({
                    userId: actx.userId, action: 'machine_update',
                    entityType: 'machine', entityId: machineId,
                    newVal: {
                        name: data.name, serial_no: data.serial_no, ocpp_id: data.ocpp_id,
                        machine_type: data.machine_type, max_power: data.max_power, status: data.status
                    },
                    ip: actx.ip, userAgent: actx.userAgent
                });
                return ownerMdl.recalcStationCountersMdl({ stationId })
                    .then(function() {
                        return df.formatSucessRes(req, res, {}, cntxtDtls, fnm, { message: 'Machine updated' });
                    });
            });
        })
        .catch(function(error) {
            console.error('[ownerCtrl] updateMachine error:', error);
            return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
        });
};

/*****************************************************************************
* Function      : addConnector
* Description   : Add a connector (port) to an owned machine
******************************************************************************/
exports.addConnector = function(req, res) {
    const fnm = "addConnector";
    const data = req.body.data ? req.body.data : req.body;
    const ownerId = req.user.userId;
    const machineId = parseInt(req.params.machineId);

    if (!machineId) return badRequest(res, 'Machine ID is required');
    const connectorType = (data.connector_type || data.type || '').trim();
    if (!connectorType) return badRequest(res, 'Connector type is required');

    ownerMdl.getOwnedMachineMdl({ ownerId, machineId })
        .then(function(rows) {
            if (!rows || rows.length === 0) return notFound(res, 'Machine not found');
            const stationId = rows[0].sttn_id;
            return ownerMdl.createConnectorMdl({
                stationId,
                machineId,
                connectorType,
                name: data.name || connectorType,
                power: data.power || rows[0].max_pwr_tx || null
            }).then(function(result) {
                const actx = audit.reqCtx(req);
                audit.writeAudit({
                    userId: actx.userId, action: 'connector_create',
                    entityType: 'connector', entityId: result.insertId,
                    newVal: { type: connectorType, machineId: machineId },
                    ip: actx.ip, userAgent: actx.userAgent
                });
                return df.formatSucessRes(req, res,
                    { connector_id: result.insertId },
                    cntxtDtls, fnm, { message: 'Connector added' });
            });
        })
        .catch(function(error) {
            console.error('[ownerCtrl] addConnector error:', error);
            return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
        });
};
