/**
 * Web Finance Controller (admin web console — djt-web).
 * Serves the Finance dashboard: franchises (station owners) and their revenue
 * share vs the DJT platform.
 *
 * GET /web/finance/franchises -> { status, rows[], summary{} }
 */

const mdl = require('../models/financeMdl');

// Default revenue split (djt-app REVENUE_SHARE_IMPLEMENTATION.md):
// DJT platform keeps 14.58%, the franchise (station owner) keeps 85.42%.
const DEFAULT_OWNER_PCT = 85.42;
const DEFAULT_PLATFORM_PCT = 14.58;

const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

// Resolve the split % for an owner: owner-specific rule > global rule > default.
function resolvePct(rules, ownerId) {
    const owner = rules.find((r) => r.scope === 'owner' && Number(r.ownerId) === Number(ownerId));
    const global = rules.find((r) => r.scope === 'global');
    const chosen = owner || global;
    if (chosen && Number.isFinite(Number(chosen.ownerPct)) && Number.isFinite(Number(chosen.platformPct))) {
        return { ownerPct: num(chosen.ownerPct), platformPct: num(chosen.platformPct) };
    }
    return { ownerPct: DEFAULT_OWNER_PCT, platformPct: DEFAULT_PLATFORM_PCT };
}

const isDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '');

exports.getFranchises = function (req, res) {
    const q = req.query || {};
    // Validate the period against the model's whitelist; default to all-time.
    const reqRange = String(q.range || 'all');
    const range = mdl.RANGES.indexOf(reqRange) >= 0 ? reqRange : 'all';
    // Optional custom date range (takes precedence when both are valid).
    const startDate = isDate(q.startDate) ? q.startDate : null;
    const endDate = isDate(q.endDate) ? q.endDate : null;
    const effRange = startDate && endDate ? 'custom' : range;

    Promise.all([mdl.franchisesMdl(range, startDate, endDate), mdl.commissionRulesMdl()])
        .then(([franchises, rules]) => {
            const list = franchises || [];
            const rls = rules || [];

            const rows = list.map((f) => {
                const gross = num(f.grossRevenue);
                const { ownerPct, platformPct } = resolvePct(rls, f.id);
                const franchiseShare = +(gross * ownerPct / 100).toFixed(2);
                // Platform absorbs the rounding remainder so the two shares sum to gross.
                const platformShare = +(gross - franchiseShare).toFixed(2);
                return {
                    id: f.id,
                    name: f.name,
                    email: f.email,
                    phone: f.phone,
                    stations: num(f.stations),
                    sessions: num(f.sessions),
                    energyKwh: +num(f.energyKwh).toFixed(2),
                    grossRevenue: +gross.toFixed(2),
                    franchiseShare,
                    platformShare,
                    sharePct: ownerPct,
                    platformPct,
                    lastActivity: f.lastActivity || null,
                    status: f.status || 'Active',
                };
            });

            const summary = rows.reduce(
                (acc, r) => {
                    acc.grossRevenue += r.grossRevenue;
                    acc.franchiseShare += r.franchiseShare;
                    acc.platformShare += r.platformShare;
                    acc.energyKwh += r.energyKwh;
                    acc.sessions += r.sessions;
                    acc.stations += r.stations;
                    return acc;
                },
                { grossRevenue: 0, franchiseShare: 0, platformShare: 0, energyKwh: 0, sessions: 0, stations: 0 }
            );
            summary.franchises = rows.length;
            summary.grossRevenue = +summary.grossRevenue.toFixed(2);
            summary.franchiseShare = +summary.franchiseShare.toFixed(2);
            summary.platformShare = +summary.platformShare.toFixed(2);
            summary.energyKwh = +summary.energyKwh.toFixed(2);
            summary.defaultOwnerPct = DEFAULT_OWNER_PCT;
            summary.defaultPlatformPct = DEFAULT_PLATFORM_PCT;

            res.status(200).json({ status: 200, range: effRange, startDate, endDate, rows, summary });
        })
        .catch((e) => {
            console.error('[finance] getFranchises', e);
            res.status(500).json({ status: 500, error: 'Failed to load franchise finance' });
        });
};
