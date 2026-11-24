/**
 * Migration runner for database-driven SMS (templates and their variables).
 *
 *   node database/run_sms_templates_migration.js
 *
 * Idempotent and additive: adds two columns to sms_tmplt_lst_t and creates
 * sms_tmplt_var_lst_t. Safe to re-run.
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { pool } = require(path.resolve(__dirname, '../config/db.config'));

async function run() {
    console.log('\n=== SMS templates migration ===');

    const sqlPath = path.resolve(__dirname, 'migrations', '2026_11_sms_templates.sql');
    const sqlText = fs.readFileSync(sqlPath, 'utf8');
    await pool.query(sqlText); // pool has multipleStatements: true
    console.log('   ✓ schema applied');

    const [tmpls] = await pool.query(
        'SELECT tmplt_id, tmplt_cd, tmplt_nm_tx, prvdr_tmplt_id_tx, a_in FROM sms_tmplt_lst_t ORDER BY tmplt_id');
    console.log(`\n   Templates (${tmpls.length}):`);
    tmpls.forEach((t) => console.log(`      • [${t.tmplt_id}] ${t.tmplt_cd || '(no code)'} — ${t.tmplt_nm_tx} (${t.prvdr_tmplt_id_tx})${t.a_in ? '' : ' [inactive]'}`));

    const [vars] = await pool.query(
        `SELECT t.tmplt_cd, v.var_nm_tx, v.src_ky_tx, v.frmt_cd
           FROM sms_tmplt_var_lst_t v JOIN sms_tmplt_lst_t t ON t.tmplt_id = v.tmplt_id
          WHERE v.a_in = 1 ORDER BY t.tmplt_id, v.var_id`);
    console.log(`\n   Variables (${vars.length}):`);
    vars.forEach((v) => console.log(`      • ${v.tmplt_cd}.${v.var_nm_tx} <- ${v.src_ky_tx || '(default only)'} [${v.frmt_cd}]`));

    console.log('\n✅ SMS templates migration complete\n');
}

run()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('\n❌ Migration failed:', err);
        process.exit(1);
    });
