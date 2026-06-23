/**
 * Web Analytics Controller
 * Single endpoint that returns the full admin analytics dashboard payload
 * (DJT HAIKA layout): 9 KPI cards + 8 charts. Shaped for
 * `frontend/src/features/dashboard/dashboardSlice.ts` -> fetchAnalytics,
 * which reads response.data.analytics.
 */

const std = require(appRoot + '/utils/standardMessages');
const mdl = require('../models/webAnalyticsMdl');
const cntxtDtls = "webAnalyticsCtrl";

const num = (v) => parseFloat(v) || 0;
const int = (v) => parseInt(v, 10) || 0;
const round2 = (v) => Math.round((num(v) + Number.EPSILON) * 100) / 100;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Build the last N calendar days as { key:'YYYY-MM-DD', label:'16 Jun' }.
function lastNDays(n) {
    const out = [];
    const today = new Date();
    for (let i = n - 1; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        out.push({ key: key, label: `${d.getDate()} ${MONTHS[d.getMonth()]}` });
    }
    return out;
}

// Merge grouped DB rows ({period, value}) onto the day skeleton (zero-filled).
function mergeSeries(skeleton, rows) {
    const map = {};
    (rows || []).forEach((r) => { map[r.period] = num(r.value); });
    return skeleton.map((d) => ({ date: d.label, value: map[d.key] || 0 }));
}

const avg = (series) => {
    if (!series.length) return 0;
    return round2(series.reduce((s, p) => s + p.value, 0) / series.length);
};

/*****************************************************************************
* Function      : getAnalytics
* Description   : Aggregate all dashboard widgets in a single response.
******************************************************************************/
exports.getAnalytics = function(req, res) {
    const fnm = "getAnalytics";
    const days = parseInt(req.query.days, 10) || 7;

    Promise.all([
        mdl.getSummaryMdl(),
        mdl.getUptimeMdl(),
        mdl.getChargeTimeSeriesMdl({ days: days }),
        mdl.getConsumptionSeriesMdl({ days: days }),
        mdl.getFailedSeriesMdl({ days: days }),
        mdl.getSessionCountMdl(),
        mdl.getChargerDowntimeMdl(),
        mdl.getStationsStatusMdl()
    ])
    .then(function([summaryRows, uptimeRows, chargeRows, consRows, failRows, scRows, dtRows, statusRows]) {
        const skeleton = lastNDays(days);
        const s = (summaryRows && summaryRows[0]) || {};
        const sc = (scRows && scRows[0]) || {};
        const dt = (dtRows && dtRows[0]) || {};

        const uptimePct = round2((uptimeRows && uptimeRows[0] && uptimeRows[0].uptime_pct) || 0);
        const uptimeSeries = skeleton.map((d) => ({ date: d.label, value: uptimePct }));
        const idleSeries = skeleton.map((d) => ({ date: d.label, value: 0 }));
        const chargeSeries = mergeSeries(skeleton, chargeRows);
        const consSeries = mergeSeries(skeleton, consRows);
        const failedSeries = mergeSeries(skeleton, failRows);

        const analytics = {
            summary: {
                partnerOrganizations: int(s.partner_orgs),
                locations: int(s.locations),
                users: int(s.users),
                chargingStations: int(s.charging_stations),
                evDrivers: int(s.ev_drivers),
                walletBalance: round2(s.wallet_balance),
                transactionAmount: round2(s.txn_amount),
                kwhConsumption: round2(s.kwh_consumption),
                walletTopupCount: int(s.wallet_topup_count)
            },
            avgUptime: { average: uptimePct, unit: '%', series: uptimeSeries },
            avgChargeTime: { average: avg(chargeSeries), unit: 'hr', series: chargeSeries },
            avgIdleTime: { average: 0, unit: 'hr', series: idleSeries },
            failedSessions: { series: failedSeries },
            consumption: { average: avg(consSeries), unit: 'kWh', series: consSeries },
            sessionCount: { finished: int(sc.finished), rejected: int(sc.rejected) },
            chargerDowntime: {
                lt12: int(dt.lt12),
                h12_24: int(dt.h12_24),
                h24_48: int(dt.h24_48),
                gt48: int(dt.gt48)
            },
            stationsStatus: (statusRows || []).map((r) => ({ status: r.status, count: int(r.count) }))
        };

        return res.status(std.message["SUCCESS"].code).json({
            status: std.message["SUCCESS"].code,
            analytics: analytics
        });
    })
    .catch(function(error) {
        console.error(`[${cntxtDtls}] ${fnm} - Error:`, error);
        return res.status(std.message["INTERNAL_ERROR"].code).json({
            status: std.message["INTERNAL_ERROR"].code,
            error: 'Failed to load analytics',
            data: null
        });
    });
};
