/**
 * Migration runner for the OCPP WebSocket audit log table.
 *
 *   node database/run_ocpp_audit_migration.js
 *
 * Idempotent and safe to re-run (CREATE TABLE IF NOT EXISTS).
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { pool } = require(path.resolve(__dirname, '../config/db.config'));

async function run() {
    console.log('\n=== OCPP audit log migration ===');

    const sqlPath = path.resolve(__dirname, 'migrations', '2026_06_ocpp_audit_log.sql');
    const sqlText = fs.readFileSync(sqlPath, 'utf8');

    console.log('→ Creating ocpp_msg_log_t ...');
    await pool.query(sqlText); // pool has multipleStatements: true
    console.log('   ✓ ocpp_msg_log_t created or verified');

    const [cols] = await pool.query(
        `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ocpp_msg_log_t'`
    );
    console.log(`   ✓ columns present: ${cols[0].n}`);

    console.log('\n✅ OCPP audit log migration complete\n');
}

run()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('\n❌ Migration failed:', err);
        process.exit(1);
    });
