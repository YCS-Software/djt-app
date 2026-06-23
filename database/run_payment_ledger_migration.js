/**
 * Phase 0 migration runner for the Payment & Double-Entry Ledger.
 *
 *   node database/run_payment_ledger_migration.js
 *
 * Idempotent and safe to re-run:
 *   1. Executes 2026_06_payment_ledger.sql (CREATE TABLE IF NOT EXISTS + master seeds)
 *   2. Adds ref_typ_cd / ref_id / jrnl_id to pay_ordr_lst_t if missing
 *   3. Seeds a default global commission rule (80% owner / 20% platform) if none exists
 *   4. Backfills ledger accounts from existing wallets (customers) and station owners
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { pool } = require(path.resolve(__dirname, '../config/db.config'));

async function columnExists(table, column) {
    const [rows] = await pool.query(
        `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [table, column]
    );
    return rows.length > 0;
}

async function addColumnIfMissing(table, column, definition) {
    if (await columnExists(table, column)) {
        console.log(`   • ${table}.${column} already present`);
        return;
    }
    await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN ${definition}`);
    console.log(`   ✓ added ${table}.${column}`);
}

async function run() {
    console.log('\n=== Payment Ledger migration ===');

    // 1) Create tables + master seeds ------------------------------------
    const sqlPath = path.resolve(__dirname, 'migrations', '2026_06_payment_ledger.sql');
    const sqlText = fs.readFileSync(sqlPath, 'utf8');
    console.log('→ Creating tables + seeding master data...');
    await pool.query(sqlText); // pool has multipleStatements: true
    console.log('   ✓ tables created / verified, masters seeded');

    // 2) Extend pay_ordr_lst_t ------------------------------------------
    console.log('→ Extending pay_ordr_lst_t...');
    await addColumnIfMissing('pay_ordr_lst_t', 'ref_typ_cd', "`ref_typ_cd` VARCHAR(30) NULL COMMENT 'session, settlement, etc' AFTER `purpose_cd`");
    await addColumnIfMissing('pay_ordr_lst_t', 'ref_id', "`ref_id` INT(11) NULL COMMENT 'linked entity id (e.g. session)' AFTER `ref_typ_cd`");
    await addColumnIfMissing('pay_ordr_lst_t', 'jrnl_id', "`jrnl_id` INT(11) NULL COMMENT 'linked posted journal entry' AFTER `trxn_id`");

    // 3) Default global commission rule ---------------------------------
    console.log('→ Ensuring default commission rule...');
    const [ruleRows] = await pool.query(
        `SELECT rule_id FROM cmsn_rule_lst_t WHERE scope_cd = 'global' AND a_in = 1 LIMIT 1`
    );
    if (ruleRows.length === 0) {
        await pool.query(
            `INSERT INTO cmsn_rule_lst_t (scope_cd, ownr_pct, platfrm_pct, tax_pct, prirty_nbr, a_in)
             VALUES ('global', 80.00, 20.00, 0.00, 0, 1)`
        );
        console.log('   ✓ inserted global rule 80/20');
    } else {
        console.log('   • global rule already present');
    }

    // 4) Backfill customer wallet accounts from wllt_lst_t --------------
    console.log('→ Backfilling customer wallet accounts...');
    const [walletBackfill] = await pool.query(`
        INSERT INTO acct_lst_t (acct_cd, acct_typ_cd, usr_id, crncy_cd, blnce_amt, is_systm_in, a_in)
        SELECT CONCAT('WALLET_', w.usr_id), 'customer_wallet', w.usr_id, 'INR',
               COALESCE(w.blnce_amt, 0), 0, 1
          FROM wllt_lst_t w
         WHERE NOT EXISTS (SELECT 1 FROM acct_lst_t a WHERE a.acct_cd = CONCAT('WALLET_', w.usr_id))
    `);
    console.log(`   ✓ customer wallet accounts created: ${walletBackfill.affectedRows}`);

    // 5) Backfill owner earnings accounts from station owners -----------
    console.log('→ Backfilling owner earnings accounts...');
    const [ownerBackfill] = await pool.query(`
        INSERT INTO acct_lst_t (acct_cd, acct_typ_cd, ownr_usr_id, crncy_cd, blnce_amt, is_systm_in, a_in)
        SELECT DISTINCT CONCAT('OWNER_', s.ownr_usr_id), 'owner_earnings', s.ownr_usr_id, 'INR', 0, 0, 1
          FROM sttn_lst_t s
         WHERE s.ownr_usr_id IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM acct_lst_t a WHERE a.acct_cd = CONCAT('OWNER_', s.ownr_usr_id))
    `);
    console.log(`   ✓ owner earnings accounts created: ${ownerBackfill.affectedRows}`);

    // Summary -----------------------------------------------------------
    const [[{ acct_n }]] = [await pool.query('SELECT COUNT(*) AS acct_n FROM acct_lst_t')].map(r => r[0]);
    console.log(`\n✅ Migration complete. Total ledger accounts: ${acct_n}\n`);
}

run()
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch(async (e) => {
        console.error('\n❌ Migration failed:', e.message || e);
        try { await pool.end(); } catch (_) {}
        process.exit(1);
    });
