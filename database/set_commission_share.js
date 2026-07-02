/**
 * Configure the DJT (platform) vs station-vendor (owner) revenue split.
 *
 *   node database/set_commission_share.js [djtPercent] [scope] [id]
 *
 * Examples:
 *   node database/set_commission_share.js 14.58            # global default (DJT 14.58%)
 *   node database/set_commission_share.js 12 owner 13      # owner-specific override (owner usr 13)
 *   node database/set_commission_share.js 10 station 12    # station-specific override (station 12)
 *
 * The split is a PERCENTAGE and is fully configurable here — change it any time
 * and future charges use the new value (resolution order: station > owner > global).
 * DJT keeps `djtPercent`%, the vendor keeps the remaining (100 - djtPercent)%.
 *
 * NOTE on the ₹3.5/unit example: at ₹24/unit, DJT ₹3.5 == 14.58%. Since the split
 * is a percentage of the total, DJT's per-unit cut scales with the unit price.
 */

require('dotenv').config();
const path = require('path');
const { pool } = require(path.resolve(__dirname, '../config/db.config'));

async function run() {
    const djtPct = Math.round((parseFloat(process.argv[2]) || 14.58) * 100) / 100;
    const scope = (process.argv[3] || 'global').toLowerCase();   // global | owner | station
    const id = process.argv[4] ? parseInt(process.argv[4], 10) : null;

    if (djtPct < 0 || djtPct > 100) throw new Error('djtPercent must be between 0 and 100');
    if ((scope === 'owner' || scope === 'station') && !id) throw new Error(`scope '${scope}' requires an id`);

    const ownerPct = Math.round((100 - djtPct) * 100) / 100;
    const sttnId = scope === 'station' ? id : null;
    const ownrUsrId = scope === 'owner' ? id : null;

    console.log('\n=== Configure commission share ===');
    console.log(`   scope=${scope}${id ? ' id=' + id : ''}  ->  DJT(platform) ${djtPct}%  /  vendor(owner) ${ownerPct}%`);

    // Deactivate any existing active rule for this exact scope target, then insert
    // a fresh effective-dated rule (keeps history; newest active rule wins).
    await pool.query(
        `UPDATE cmsn_rule_lst_t SET a_in = 0, eff_to_ts = NOW()
          WHERE a_in = 1 AND scope_cd = ?
            AND ${sttnId === null ? 'sttn_id IS NULL' : 'sttn_id = ?'}
            AND ${ownrUsrId === null ? 'ownr_usr_id IS NULL' : 'ownr_usr_id = ?'}`,
        [scope, ...(sttnId === null ? [] : [sttnId]), ...(ownrUsrId === null ? [] : [ownrUsrId])]
    );

    const prio = scope === 'station' ? 30 : scope === 'owner' ? 20 : 0;
    await pool.query(
        `INSERT INTO cmsn_rule_lst_t (scope_cd, sttn_id, ownr_usr_id, ownr_pct, platfrm_pct, tax_pct, prirty_nbr, eff_frm_ts, a_in)
         VALUES (?, ?, ?, ?, ?, 0.00, ?, NOW(), 1)`,
        [scope, sttnId, ownrUsrId, ownerPct, djtPct, prio]
    );

    const [rows] = await pool.query(
        `SELECT rule_id, scope_cd, sttn_id, ownr_usr_id, ownr_pct, platfrm_pct, prirty_nbr, a_in
           FROM cmsn_rule_lst_t WHERE a_in = 1 ORDER BY FIELD(scope_cd,'station','owner','global'), prirty_nbr DESC`
    );
    console.log('   active rules now:');
    rows.forEach(r => console.log(`     #${r.rule_id} ${r.scope_cd} sttn=${r.sttn_id ?? '-'} ownr=${r.ownr_usr_id ?? '-'} -> owner ${r.ownr_pct}% / platform ${r.platfrm_pct}%`));
    console.log('\n✅ Commission share configured\n');
}

run().then(() => process.exit(0)).catch((e) => { console.error('❌ Failed:', e.message); process.exit(1); });
