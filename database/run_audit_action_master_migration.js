/**
 * Migration runner for the audit action master (actn_lst_t).
 *
 *   node database/run_audit_action_master_migration.js
 *
 * Idempotent and safe to re-run (CREATE TABLE IF NOT EXISTS + upsert seed).
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { pool } = require(path.resolve(__dirname, '../config/db.config'));

async function run() {
    console.log('\n=== Audit action master migration ===');

    const sqlPath = path.resolve(__dirname, 'migrations', '2026_06_audit_action_master.sql');
    const sqlText = fs.readFileSync(sqlPath, 'utf8');

    console.log('→ Creating actn_lst_t + seeding action codes...');
    await pool.query(sqlText); // pool has multipleStatements: true
    console.log('   ✓ actn_lst_t created or verified');

    const [rows] = await pool.query(
        'SELECT ctgry_cd, COUNT(*) AS n FROM actn_lst_t WHERE a_in = 1 GROUP BY ctgry_cd ORDER BY ctgry_cd'
    );
    const [[tot]] = await pool.query('SELECT COUNT(*) AS n FROM actn_lst_t');
    console.log(`   ✓ actions seeded: ${tot.n}`);
    rows.forEach((r) => console.log(`      • ${r.ctgry_cd}: ${r.n}`));

    console.log('\n✅ Audit action master migration complete\n');
}

run()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('\n❌ Migration failed:', err);
        process.exit(1);
    });
