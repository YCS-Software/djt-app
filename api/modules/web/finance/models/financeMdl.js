/**
 * Web Finance Model (admin web console — djt-web).
 * Franchise (station-owner) revenue and its split between the franchise and the
 * DJT platform, derived from the live `*_lst_t` schema. Read-only SELECTs only.
 *
 * Revenue is the sum of completed charging-session costs (`sssn_lst_t.ttl_cst_amt`)
 * on the stations each owner owns (`sttn_lst_t.ownr_usr_id`). The franchise/DJT
 * split comes from `cmsn_rule_lst_t` when present, else a default (see controller).
 */

const sqldb = require(appRoot + '/config/db.config');
const dbutil = require(appRoot + '/utils/db.utils');
const cntxtDtls = "financeMdl";

// Date-range predicates applied to the completed-session join (on `strt_ts`).
// Keys are a fixed whitelist (never user free-text) so they stay inline safely.
// The predicate lives in the LEFT JOIN's ON clause so franchises with no
// sessions in the period still appear with zero revenue.
const RANGE_PREDICATES = {
    all: '',
    today: 'AND DATE(se.strt_ts) = CURDATE()',
    month: 'AND YEAR(se.strt_ts) = YEAR(CURDATE()) AND MONTH(se.strt_ts) = MONTH(CURDATE())',
    year: 'AND YEAR(se.strt_ts) = YEAR(CURDATE())',
};
exports.RANGES = Object.keys(RANGE_PREDICATES);

const isDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '');

/*****************************************************************************
* Function      : franchisesMdl
* Description   : Per-franchise gross revenue, energy, session count and last
*                 activity, aggregated from completed sessions on owned stations
*                 within the selected period. A valid custom start/end date
*                 range takes precedence over the named `range`.
* Arguments     : range     - one of exports.RANGES (defaults to 'all')
*                 startDate - optional YYYY-MM-DD (inclusive)
*                 endDate   - optional YYYY-MM-DD (inclusive)
******************************************************************************/
exports.franchisesMdl = function (range, startDate, endDate) {
    let datePred = RANGE_PREDICATES[range] || RANGE_PREDICATES.all;
    const PARAMS = [];
    // Custom range wins when both bounds are valid dates.
    if (isDate(startDate) && isDate(endDate)) {
        datePred = 'AND DATE(se.strt_ts) BETWEEN ? AND ?';
        PARAMS.push(startDate, endDate);
    }
    const QRY = `SELECT u.usr_id AS id,
                        u.nm_tx AS name,
                        u.eml_tx AS email,
                        u.phn_nmbr_tx AS phone,
                        (SELECT COUNT(*) FROM sttn_lst_t s2 WHERE s2.ownr_usr_id = u.usr_id AND s2.a_in = 1) AS stations,
                        COUNT(se.sssn_id) AS sessions,
                        COALESCE(SUM(se.enrgy_cnsmd_kwh), 0) AS energyKwh,
                        COALESCE(SUM(se.ttl_cst_amt), 0) AS grossRevenue,
                        MAX(se.strt_ts) AS lastActivity,
                        CASE WHEN u.a_in = 1 THEN 'Active' ELSE 'Inactive' END AS status
                 FROM usr_lst_t u
                 LEFT JOIN sttn_lst_t st ON st.ownr_usr_id = u.usr_id AND st.a_in = 1
                 LEFT JOIN sssn_lst_t se ON se.sttn_id = st.sttn_id AND se.sttus_cd = 'completed' ${datePred}
                 WHERE u.usr_typ_cd = 'owner'
                 GROUP BY u.usr_id, u.nm_tx, u.eml_tx, u.phn_nmbr_tx, u.a_in
                 ORDER BY grossRevenue DESC`;
    return dbutil.execQuery(sqldb.MySQLConPool, QRY, PARAMS, cntxtDtls);
};

/*****************************************************************************
* Function      : commissionRulesMdl
* Description   : Active commission-split rules (global + per-owner overrides).
*                 Degrades to [] if the table/columns are absent so the finance
*                 dashboard can fall back to the default split.
******************************************************************************/
exports.commissionRulesMdl = function () {
    const QRY = `SELECT scope_cd AS scope,
                        ownr_usr_id AS ownerId,
                        ownr_pct AS ownerPct,
                        platfrm_pct AS platformPct
                 FROM cmsn_rule_lst_t
                 WHERE a_in = 1 AND (eff_to_ts IS NULL OR eff_to_ts > NOW())
                 ORDER BY prirty_nbr DESC, rule_id DESC`;
    return dbutil.execQuery(sqldb.MySQLConPool, QRY, [], cntxtDtls).catch(() => []);
};
