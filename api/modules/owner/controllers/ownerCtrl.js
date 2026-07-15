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
        code: c.cnntr_cd_tx || null,
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
        ownerMdl.getOwnerDashboardMdl({ ownerId }),
        ownerMdl.getOwnerNetTotalsMdl({ ownerId }),
        ownerMdl.getOwnerNetHourlySeriesMdl({ ownerId }),
        ownerMdl.getOwnerBalanceMdl({ ownerId }),
        ownerMdl.getOwnerEscrowHeldMdl({ ownerId }),
        ownerMdl.getOwnerCommissionRuleMdl({ ownerId }),
        ownerMdl.getOwnerDirectCollectedMdl({ ownerId })
    ]).then(function(results) {
        const t = (results[0] && results[0][0]) || {};
        const mo = (results[1] && results[1][0]) || {};
        const hourlyRows = results[2] || [];
        const statusRows = results[3] || [];
        const recentRows = results[4] || [];
        const tr = (results[5] && results[5][0]) || {};
        const counts = (results[6] && results[6][0]) || {};
        const net = (results[7] && results[7][0]) || {};
        const netHourlyRows = results[8] || [];
        const bal = (results[9] && results[9][0]) || {};
        const esc = (results[10] && results[10][0]) || {};
        const rule = (results[11] && results[11][0]) || {};
        const dc = (results[12] && results[12][0]) || {};

        // `billed` is everything the driver paid (GST-inclusive, straight off the
        // session rows). `net` is what the ledger credited this owner. The two are
        // bridged by the DJT share plus any energy collected at the machine:
        //     billed = net + commission + direct_collected
        const todayBilled = Number(t.today_revenue) || 0;
        const monthBilled = Number(mo.month_revenue) || 0;
        const todayEnergy = Number(t.today_energy) || 0;
        const monthEnergy = Number(mo.month_energy) || 0;

        const todayNet = Number(net.today_net) || 0;
        const monthNet = Number(net.month_net) || 0;
        const monthCmsn = Number(net.month_cmsn) || 0;
        const todayDirect = Number(dc.today_direct) || 0;
        const monthDirect = Number(dc.month_direct) || 0;
        const r2 = function(n) { return Math.round(n * 100) / 100; };

        // Fill 24 hourly buckets (00:00 .. 23:00) from the sparse query results.
        // `revenue` is now the owner's net; gross rides along for the tooltip.
        const byHour = {};
        hourlyRows.forEach(function(r) { byHour[Number(r.hr)] = r; });
        const netByHour = {};
        netHourlyRows.forEach(function(r) { netByHour[Number(r.hr)] = r; });
        const hourly = [];
        for (let h = 0; h < 24; h++) {
            const row = byHour[h];
            const nRow = netByHour[h];
            hourly.push({
                hour: (h < 10 ? '0' + h : '' + h) + ':00',
                revenue: nRow ? Number(nRow.net_amt) || 0 : 0,
                gross: row ? Number(row.revenue) || 0 : 0,
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
                net: Number(r.net_amt) || 0,
                gross: Number(r.ttl_cst_amt) || 0,
                status: r.sttus_cd,
                payment_status: r.pymnt_sttus_cd || null,
                started_at: r.strt_ts
            };
        });

        return df.formatSucessRes(req, res, {
            cards: {
                stations: { value: totalStations, trend_pct: trend(totalStations, tr.stations_prev) },
                machines: { value: totalMachines, trend_pct: trend(totalMachines, tr.machines_prev) },
                connectors: { value: totalConnectors, trend_pct: trend(totalConnectors, tr.connectors_prev) },
                // Not a trend: this is the share of machines currently free. The UI
                // renders it as a plain ratio, without an up/down arrow.
                available: { value: availableMachines, ratio_pct: totalMachines > 0 ? Math.round((availableMachines / totalMachines) * 100) : 0 }
            },
            today: {
                net: todayNet,
                billed: todayBilled,
                direct_collected: todayDirect,
                total_earned: r2(todayNet + todayDirect),
                consumption: todayEnergy,
                transactions: Number(t.today_txns) || 0,
                net_trend_pct: trend(todayNet, net.yest_net),
                consumption_trend_pct: trend(todayEnergy, t.yest_energy)
            },
            month: {
                net: monthNet,
                billed: monthBilled,
                commission: monthCmsn,
                direct_collected: monthDirect,
                total_earned: r2(monthNet + monthDirect),
                consumption: monthEnergy,
                // Per-kWh yield uses what the owner keeps, not the ledger-only slice.
                avg_net_per_kwh: monthEnergy > 0 ? r2((monthNet + monthDirect) / monthEnergy) : 0,
                transactions: Number(mo.month_txns) || 0,
                net_trend_pct: trend(monthNet, net.prev_month_net)
            },
            balance: {
                available: Number(bal.blnce_amt) || 0,
                in_escrow: Number(esc.held_amt) || 0,
                active_sessions: Number(esc.active_sessions) || 0
            },
            commission: {
                owner_pct: rule.ownr_pct != null ? Number(rule.ownr_pct) : null,
                platform_pct: rule.platfrm_pct != null ? Number(rule.platfrm_pct) : null,
                tax_pct: rule.tax_pct != null ? Number(rule.tax_pct) : 0,
                scope: rule.scope_cd || null
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
* Date-range helpers for the earnings / station-analytics endpoints.
* Accept ?from=YYYY-MM-DD&to=YYYY-MM-DD; default to month-to-date.
******************************************************************************/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function pad2(n) { return n < 10 ? '0' + n : '' + n; }

function isoDate(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

// Returns { from, to } or null when a supplied value is malformed / inverted.
function resolveRange(query) {
    const now = new Date();
    const to = query.to || isoDate(now);
    const from = query.from || isoDate(new Date(now.getFullYear(), now.getMonth(), 1));
    if (!DATE_RE.test(from) || !DATE_RE.test(to)) return null;
    if (from > to) return null;
    return { from, to };
}

/*****************************************************************************
* Function      : getEarnings
* Description   : What the owner actually earns, sourced from the double-entry
*                 ledger rather than sssn_lst_t.ttl_cst_amt (which is what the
*                 driver paid). Returns the net/commission/gross breakdown, the
*                 payout balance, escrow held on in-flight sessions, the active
*                 commission rule plus any station-scoped overrides, refunds,
*                 and energy collected directly at the machine beyond the hold.
******************************************************************************/
exports.getEarnings = function(req, res) {
    const fnm = "getEarnings";
    const ownerId = req.user.userId;

    function trend(curr, prev) {
        curr = Number(curr) || 0; prev = Number(prev) || 0;
        if (prev === 0) return curr > 0 ? 100 : 0;
        return Math.round(((curr - prev) / prev) * 1000) / 10;
    }

    Promise.all([
        ownerMdl.getOwnerNetTotalsMdl({ ownerId }),
        ownerMdl.getOwnerBalanceMdl({ ownerId }),
        ownerMdl.getOwnerEscrowHeldMdl({ ownerId }),
        ownerMdl.getOwnerCommissionRuleMdl({ ownerId }),
        ownerMdl.getOwnerStationRuleOverridesMdl({ ownerId }),
        ownerMdl.getOwnerRefundsMdl({ ownerId }),
        ownerMdl.getOwnerDirectCollectedMdl({ ownerId })
    ]).then(function(results) {
        const n = (results[0] && results[0][0]) || {};
        const bal = (results[1] && results[1][0]) || {};
        const esc = (results[2] && results[2][0]) || {};
        const rule = (results[3] && results[3][0]) || {};
        const overrides = results[4] || [];
        const ref = (results[5] && results[5][0]) || {};
        const dc = (results[6] && results[6][0]) || {};

        const todayDirect = Number(dc.today_direct) || 0;
        const monthDirect = Number(dc.month_direct) || 0;
        const lifetimeDirect = Number(dc.lifetime_direct) || 0;

        function period(netKey, cmsnKey, direct) {
            const net = Number(n[netKey]) || 0;
            const cmsn = Number(n[cmsnKey]) || 0;
            const d = direct || 0;
            return {
                net: net,
                commission: cmsn,
                // What passed through the ledger. Excludes over-hold energy, so it
                // is NOT the amount the driver was billed — use `billed` for that.
                settled: Math.round((net + cmsn) * 100) / 100,
                // Everything the driver paid, GST-inclusive. The identity that
                // holds on screen is: billed - commission = total_earned.
                billed: Math.round((net + cmsn + d) * 100) / 100,
                direct_collected: d,
                // What the owner actually keeps: their ledger share plus the
                // over-hold energy they collected at the machine (no DJT share).
                total_earned: Math.round((net + d) * 100) / 100
            };
        }

        const month = period('month_net', 'month_cmsn', monthDirect);
        month.net_trend_pct = trend(month.net, n.prev_month_net);

        return df.formatSucessRes(req, res, {
            today: period('today_net', 'today_cmsn', todayDirect),
            month: month,
            lifetime: period('lifetime_net', 'lifetime_cmsn', lifetimeDirect),
            balance: {
                available: Number(bal.blnce_amt) || 0,
                currency: bal.crncy_cd || 'INR',
                in_escrow: Number(esc.held_amt) || 0,
                active_sessions: Number(esc.active_sessions) || 0
            },
            commission: {
                owner_pct: rule.ownr_pct != null ? Number(rule.ownr_pct) : null,
                platform_pct: rule.platfrm_pct != null ? Number(rule.platfrm_pct) : null,
                // No tax leg is posted by ledgerService today, so tax always
                // settles to 0. The UI hides the row when this is 0.
                tax_pct: rule.tax_pct != null ? Number(rule.tax_pct) : 0,
                scope: rule.scope_cd || null,
                station_overrides: overrides.map(function(o) {
                    return {
                        station_id: o.sttn_id,
                        station: o.sttn_nm_tx,
                        owner_pct: Number(o.ownr_pct),
                        platform_pct: Number(o.platfrm_pct)
                    };
                })
            },
            refunds: {
                month: Number(ref.month_refunds) || 0,
                lifetime: Number(ref.lifetime_refunds) || 0
            },
            // Energy delivered past the driver's prepaid hold. Collected by the
            // owner at the machine, outside the ledger, commission-free.
            direct_collected: {
                today: todayDirect,
                month: monthDirect,
                lifetime: lifetimeDirect,
                session_count: Number(dc.session_count) || 0
            }
        }, cntxtDtls, fnm, {});
    }).catch(function(error) {
        console.error('[ownerCtrl] getEarnings error:', error);
        return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
    });
};

/*****************************************************************************
* Function      : getSettlements
* Description   : This owner's payout history from setlmnt_lst_t. Reads the live
*                 schema (gross/cmsn/tax/net + UTR), not the stale column names
*                 used by the admin web settlements model.
******************************************************************************/
exports.getSettlements = function(req, res) {
    const fnm = "getSettlements";
    const ownerId = req.user.userId;
    const limit = parseInt(req.query.limit, 10) || 12;

    ownerMdl.getOwnerSettlementsMdl({ ownerId, limit })
        .then(function(rows) {
            const settlements = (rows || []).map(function(s) {
                return {
                    settlement_id: s.setlmnt_id,
                    period_from: s.prd_frm_dt,
                    period_to: s.prd_to_dt,
                    gross: Number(s.gross_amt) || 0,
                    commission: Number(s.cmsn_amt) || 0,
                    tax: Number(s.tax_amt) || 0,
                    net: Number(s.net_amt) || 0,
                    status: s.sttus_cd,
                    utr: s.utr_tx || null,
                    settled_at: s.u_ts,
                    created_at: s.i_ts
                };
            });

            const pending = settlements
                .filter(function(s) { return s.status === 'pending'; })
                .reduce(function(a, s) { return a + s.net; }, 0);

            return df.formatSucessRes(req, res, {
                settlements: settlements,
                pending_net: Math.round(pending * 100) / 100,
                last_settled: settlements.find(function(s) { return s.status === 'settled'; }) || null
            }, cntxtDtls, fnm, {});
        })
        .catch(function(error) {
            console.error('[ownerCtrl] getSettlements error:', error);
            return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
        });
};

/*****************************************************************************
* Function      : getStationBreakdown
* Description   : Station-wise analytics over a date window: net earnings (from
*                 the ledger), gross, kWh, transactions, utilisation, failure
*                 rate and machine health. Stations with no sessions still
*                 appear, at zero, so a dead station is visible rather than absent.
******************************************************************************/
exports.getStationBreakdown = function(req, res) {
    const fnm = "getStationBreakdown";
    const ownerId = req.user.userId;

    // `?range=lifetime` widens the window back to the owner's first activity.
    // There is no earlier period to compare against, so trends are suppressed.
    const isLifetime = req.query.range === 'lifetime';

    const resolveWindow = isLifetime
        ? ownerMdl.getOwnerFirstActivityMdl({ ownerId }).then(function(rows) {
            const first = rows && rows[0] && rows[0].first_dt;
            const from = first ? isoDate(new Date(first)) : isoDate(new Date());
            return { from: from, to: isoDate(new Date()) };
        })
        : Promise.resolve(resolveRange(req.query));

    resolveWindow.then(function(range) {
    if (!range) return badRequest(res, 'Invalid date range; expected from/to as YYYY-MM-DD with from <= to');
    const { from, to } = range;

    // Inclusive day count -> machine-minutes available in the window.
    const days = Math.floor((Date.parse(to) - Date.parse(from)) / 86400000) + 1;

    function trend(curr, prev) {
        if (isLifetime) return null;   // no prior window exists
        curr = Number(curr) || 0; prev = Number(prev) || 0;
        if (prev === 0) return curr > 0 ? 100 : 0;
        return Math.round(((curr - prev) / prev) * 1000) / 10;
    }

    return Promise.all([
        ownerMdl.getOwnerStationUsageMdl({ ownerId, from, to }),
        ownerMdl.getOwnerNetByStationMdl({ ownerId, from, to }),
        isLifetime ? Promise.resolve([]) : ownerMdl.getOwnerNetByStationPrevMdl({ ownerId, from, to }),
        ownerMdl.getOwnerStationHealthMdl({ ownerId })
    ]).then(function(results) {
        const usage = results[0] || [];
        const netRows = results[1] || [];
        const prevRows = results[2] || [];
        const health = results[3] || [];

        const netById = {};
        netRows.forEach(function(r) { netById[r.sttn_id] = r; });
        const prevById = {};
        prevRows.forEach(function(r) { prevById[r.sttn_id] = Number(r.net_amt) || 0; });
        const healthById = {};
        health.forEach(function(r) { healthById[r.sttn_id] = r; });

        const stations = usage.map(function(u) {
            const n = netById[u.sttn_id] || {};
            const h = healthById[u.sttn_id] || {};
            const net = Number(n.net_amt) || 0;
            const cmsn = Number(n.cmsn_amt) || 0;
            const machines = Number(h.machines) || 0;
            const chargeMins = Number(u.charge_mins) || 0;
            const txns = Number(u.txns) || 0;
            const failed = Number(u.failed_txns) || 0;
            const capacityMins = machines * days * 24 * 60;

            return {
                station_id: u.sttn_id,
                name: u.sttn_nm_tx,
                city: u.cty_tx || null,
                operator: u.oprtr_nm_tx || null,
                approval_status: u.aprvl_sttus_cd,
                net: net,
                commission: cmsn,
                gross: Math.round((net + cmsn) * 100) / 100,
                // Gross straight off the session rows; differs from net+commission
                // when energy was delivered beyond the driver's prepaid hold.
                session_gross: Number(u.gross_amt) || 0,
                consumption: Number(u.kwh) || 0,
                transactions: txns,
                failed_transactions: failed,
                failure_rate_pct: (txns + failed) > 0 ? Math.round((failed / (txns + failed)) * 1000) / 10 : 0,
                charge_minutes: chargeMins,
                utilisation_pct: capacityMins > 0 ? Math.round((chargeMins / capacityMins) * 1000) / 10 : 0,
                net_trend_pct: trend(net, prevById[u.sttn_id]),
                machines: machines,
                faulted_machines: Number(h.faulted) || 0,
                offline_machines: Number(h.offline) || 0,
                maintenance_machines: Number(h.maintenance) || 0,
                last_heartbeat_ts: h.last_heartbeat_ts || null,
                mins_since_heartbeat: h.mins_since_heartbeat != null ? Number(h.mins_since_heartbeat) : null
            };
        });

        stations.sort(function(a, b) { return b.net - a.net; });

        const totalNet = stations.reduce(function(a, s) { return a + s.net; }, 0);
        stations.forEach(function(s) {
            s.share_pct = totalNet > 0 ? Math.round((s.net / totalNet) * 1000) / 10 : 0;
        });

        const totals = {
            net: Math.round(totalNet * 100) / 100,
            commission: Math.round(stations.reduce(function(a, s) { return a + s.commission; }, 0) * 100) / 100,
            consumption: Math.round(stations.reduce(function(a, s) { return a + s.consumption; }, 0) * 1000) / 1000,
            transactions: stations.reduce(function(a, s) { return a + s.transactions; }, 0),
            stations: stations.length
        };
        const totalCapacity = stations.reduce(function(a, s) { return a + s.machines; }, 0) * days * 24 * 60;
        const totalMins = stations.reduce(function(a, s) { return a + s.charge_minutes; }, 0);
        totals.utilisation_pct = totalCapacity > 0 ? Math.round((totalMins / totalCapacity) * 1000) / 10 : 0;

        // Anything the owner should act on: dead chargers and faults.
        const attention = [];
        stations.forEach(function(s) {
            if (s.faulted_machines > 0) {
                attention.push({ station_id: s.station_id, station: s.name, kind: 'faulted',
                    message: s.faulted_machines + ' machine(s) faulted' });
            }
            if (s.machines > 0 && s.mins_since_heartbeat != null && s.mins_since_heartbeat > 60) {
                attention.push({ station_id: s.station_id, station: s.name, kind: 'no_heartbeat',
                    message: 'No OCPP heartbeat for ' + Math.floor(s.mins_since_heartbeat / 60) + 'h',
                    mins_since_heartbeat: s.mins_since_heartbeat });
            }
            if (s.machines > 0 && s.last_heartbeat_ts == null) {
                attention.push({ station_id: s.station_id, station: s.name, kind: 'never_seen',
                    message: 'Charger has never reported a heartbeat' });
            }
        });

        return df.formatSucessRes(req, res, {
            range: { from: from, to: to, days: days, lifetime: isLifetime },
            totals: totals,
            stations: stations,
            attention: attention
        }, cntxtDtls, fnm, {});
    });
    }).catch(function(error) {
        console.error('[ownerCtrl] getStationBreakdown error:', error);
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
* Function      : getConnectorQr
* Description   : Signed, app-only QR token for ONE connector (each plug has its
*                 own QR). Encodes the connector id + code, OCPP id, WS URL,
*                 price and machine/station details. Ownership enforced.
******************************************************************************/
exports.getConnectorQr = function(req, res) {
    const fnm = "getConnectorQr";
    const ownerId = req.user.userId;
    const connectorId = parseInt(req.params.connectorId);
    if (!connectorId) return badRequest(res, 'Connector ID is required');

    ownerMdl.getOwnedConnectorMdl({ ownerId, connectorId })
        .then(function(rows) {
            const c = rows && rows[0];
            if (!c) return notFound(res, 'Connector not found');

            const wsUrl = c.ocpp_id_tx ? ocppWsUrl(c.ocpp_id_tx) : null;
            const powerLabel = c.pwr_lbl_tx || (c.max_pwr_tx ? `${c.mchn_typ_cd} ${c.max_pwr_tx}` : null);
            const price = parseFloat(c.prce_per_kwh_amt) || 0;

            const payload = {
                v: 1,
                t: 'connector',
                cid: c.cnntr_id,
                mid: c.mchn_id,
                sid: c.sttn_id,
                ccode: c.cnntr_cd_tx || null,
                ctyp: c.cnntr_typ_cd,
                ocpp: c.ocpp_id_tx || null,
                ws: wsUrl,
                price: price,
                st: c.sttn_nm_tx,
                mn: c.mchn_nm_tx,
                typ: c.mchn_typ_cd,
                pwr: powerLabel
            };

            return df.formatSucessRes(req, res, {
                token: qrUtil.encode(payload),
                connector: {
                    connector_id: c.cnntr_id,
                    code: c.cnntr_cd_tx || null,
                    type: c.cnntr_typ_cd,
                    name: c.cnntr_nm_tx,
                    power: c.pwr_tx || powerLabel,
                    is_available: c.is_avlbl_in === 1,
                    machine_id: c.mchn_id,
                    machine_name: c.mchn_nm_tx,
                    machine_type: c.mchn_typ_cd,
                    station_name: c.sttn_nm_tx,
                    ocpp_id: c.ocpp_id_tx || null,
                    ws_url: wsUrl,
                    price_per_kwh: price,
                    configured: !!c.ocpp_id_tx
                }
            }, cntxtDtls, fnm, {});
        })
        .catch(function(error) {
            console.error('[ownerCtrl] getConnectorQr error:', error);
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

    // Optional inclusive date window. Supplying only one bound is a client bug,
    // so reject it rather than silently listing everything.
    const from = req.query.from;
    const to = req.query.to;
    if ((from && !to) || (to && !from)) {
        return badRequest(res, 'Both from and to are required when filtering by date');
    }
    if (from && to) {
        if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
            return badRequest(res, 'Invalid date range; expected from/to as YYYY-MM-DD');
        }
        if (from > to) return badRequest(res, 'Invalid date range; from must be <= to');
    }

    ownerMdl.getOwnerTransactionsMdl({ ownerId, limit, from: from, to: to })
        .then(function(rows) {
            const round2 = function(n) { return Math.round(n * 100) / 100; };

            const transactions = (rows || []).map(function(r) {
                const cost = Number(r.ttl_cst_amt) || 0;      // what the driver was billed
                const net = Number(r.net_amt) || 0;           // credited to the owner
                const cmsn = Number(r.cmsn_amt) || 0;         // kept by the platform
                const settled = round2(net + cmsn);           // what passed through the ledger

                // Percentages are derived from the amounts actually posted, not from
                // the commission rule, so they reflect real rounding (splitConsumed
                // floors the owner's paise and gives the remainder to the platform).
                const ownerPct = settled > 0 ? Math.round((net / settled) * 1000) / 10 : null;
                const platformPct = settled > 0 ? Math.round((cmsn / settled) * 1000) / 10 : null;

                return {
                    code: r.sssn_cd,
                    station: r.sttn_nm_tx,
                    connector: r.cnntr_nm_tx || null,
                    customer: r.usr_nm || null,
                    energy_kwh: Number(r.enrgy_cnsmd_kwh) || 0,
                    duration_min: r.durn_mnts_nbr != null ? Number(r.durn_mnts_nbr) : null,
                    cost: cost,
                    settled: settled,
                    net: net,
                    commission: cmsn,
                    owner_pct: ownerPct,
                    platform_pct: platformPct,
                    // Energy past the prepaid hold, collected at the machine. Never
                    // reaches the ledger, so no commission is taken from it.
                    direct_collected: round2(Math.max(cost - settled, 0)),
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

    // connectors: user-chosen, clamp 1..2 (default 2)
    const connectorCount = Math.min(Math.max(parseInt(data.connector_count) || 2, 1), 2);

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

                        // create the chosen number of connectors, each with a unique code
                        const connPromises = [];
                        for (let i = 1; i <= connectorCount; i++) {
                            const connectorCode = `${ocppId}-C${i}`;
                            connPromises.push(ownerMdl.createConnectorMdl({
                                stationId, machineId,
                                code: connectorCode,
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
