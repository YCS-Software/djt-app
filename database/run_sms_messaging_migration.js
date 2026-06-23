/**
 * Migration runner for the SMS messaging tables.
 *
 *   node database/run_sms_messaging_migration.js
 *
 * Idempotent and safe to re-run:
 *   1. Creates sms_tmplt_lst_t + sms_msg_log_t (CREATE TABLE IF NOT EXISTS)
 *   2. Upserts the OTP template seed
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { pool } = require(path.resolve(__dirname, '../config/db.config'));

async function run() {
    console.log('\n=== SMS messaging migration ===');

    const sqlPath = path.resolve(__dirname, 'migrations', '2026_06_sms_messaging.sql');
    const sqlText = fs.readFileSync(sqlPath, 'utf8');

    console.log('→ Creating tables + seeding OTP template...');
    await pool.query(sqlText); // pool has multipleStatements: true
    console.log('   ✓ sms_tmplt_lst_t / sms_msg_log_t created or verified');

    const [tmpls] = await pool.query(
        'SELECT tmplt_id, prvdr_tmplt_id_tx, tmplt_nm_tx FROM sms_tmplt_lst_t'
    );
    console.log(`   ✓ templates present: ${tmpls.length}`);
    tmpls.forEach((t) =>
        console.log(`      • [${t.tmplt_id}] ${t.tmplt_nm_tx} (${t.prvdr_tmplt_id_tx})`)
    );

    console.log('\n✅ SMS messaging migration complete\n');
}

run()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('\n❌ Migration failed:', err);
        process.exit(1);
    });
