/**
 * One-time wallet balance reconciliation.
 *
 *   node database/reconcile_wallet_balances.js
 *
 * Recomputes every user's true balance from the transaction ledger
 * (credits + refunds - debits) and writes it back to BOTH caches:
 *   - wllt_lst_t.blnce_amt        (used by /wallet/balance, charging checks)
 *   - acct_lst_t (WALLET_<user>)  (the double-entry ledger account)
 *
 * Fixes balances that drifted when top-ups were written by different code paths
 * (legacy /wallet/add-money vs the ledger /payment/verify). Safe to re-run.
 */

require('dotenv').config();
const path = require('path');
const { pool } = require(path.resolve(__dirname, '../config/db.config'));

async function run() {
    console.log('\n=== Wallet balance reconciliation ===');

    const [wallets] = await pool.query(`SELECT wllt_id, usr_id, blnce_amt FROM wllt_lst_t`);
    let fixed = 0;

    for (const w of wallets) {
        const [[{ bal }]] = [await pool.query(
            `SELECT COALESCE(SUM(
                CASE WHEN trxn_typ_cd IN ('credit','refund') THEN amt
                     WHEN trxn_typ_cd = 'debit' THEN -amt ELSE 0 END), 0) AS bal
               FROM trxn_lst_t
              WHERE usr_id = ? AND a_in = 1 AND (sttus_cd = 'completed' OR sttus_cd IS NULL)`,
            [w.usr_id])].map(r => r[0]);

        const trueBal = parseFloat(bal) || 0;
        const cached = parseFloat(w.blnce_amt) || 0;

        const [acctRows] = await pool.query(
            `SELECT acct_id, blnce_amt FROM acct_lst_t WHERE acct_cd = ?`, [`WALLET_${w.usr_id}`]);
        const acct = acctRows[0];
        const acctBal = acct ? parseFloat(acct.blnce_amt) || 0 : null;

        const walletDrift = Math.abs(cached - trueBal) > 0.001;
        const acctDrift = acct && Math.abs(acctBal - trueBal) > 0.001;

        if (walletDrift) {
            await pool.query(`UPDATE wllt_lst_t SET blnce_amt = ?, lst_updtd_ts = NOW() WHERE wllt_id = ?`, [trueBal, w.wllt_id]);
        }
        if (acctDrift) {
            await pool.query(`UPDATE acct_lst_t SET blnce_amt = ?, u_ts = NOW() WHERE acct_id = ?`, [trueBal, acct.acct_id]);
        }
        if (walletDrift || acctDrift) {
            fixed++;
            console.log(`  user ${w.usr_id}: wallet ${cached} -> ${trueBal}` +
                (acct ? ` | acct ${acctBal} -> ${trueBal}` : ' | (no ledger acct)'));
        }
    }

    console.log(`\n✅ Reconciled ${fixed} wallet(s) of ${wallets.length} total.\n`);
}

run()
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch(async (e) => { console.error('❌', e.message || e); try { await pool.end(); } catch (_) {} process.exit(1); });
