/**
 * Payment / Double-Entry Ledger — integration test suite.
 *
 *   node tests/payment/ledger.test.js
 *
 * What it does:
 *   - sets up isolated fixtures (a test customer, a test owner, a test station)
 *   - exercises every flow + edge case against the real DEV database
 *   - asserts wallet/owner/platform/escrow balances, idempotency, rounding,
 *     insufficient funds, commission overrides and the double-entry invariant
 *   - writes a timestamped result log to tests/payment/results/
 *   - cleans up ALL data it created (and restores system-account balances)
 *
 * Exit code is non-zero if any case fails, so it doubles as a CI check.
 * Re-run any time the ledger logic changes.
 */

const path = require("path");
const fs = require("fs");
require("dotenv").config();
global.appRoot = path.resolve(__dirname, "../..");

const ledger = require(appRoot + "/api/modules/ledger/services/ledgerService");
const mdl = require(appRoot + "/api/modules/ledger/models/ledgerMdl");
const pool = mdl.pool;

const q = (sql, params) => pool.query(sql, params);

/* --------------------------- tiny test harness --------------------------- */
const results = [];
let logLines = [];
function log(line) {
  console.log(line);
  logLines.push(line);
}

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  log(
    `${ok ? "  ✅ PASS" : "  ❌ FAIL"} — ${name}${detail ? `  (${detail})` : ""}`,
  );
}
function approx(a, b, eps = 0.005) {
  return Math.abs(Number(a) - Number(b)) < eps;
}

async function expectEq(name, actual, expected) {
  record(name, approx(actual, expected), `expected ${expected}, got ${actual}`);
}
async function expectTrue(name, cond, detail) {
  record(name, !!cond, detail);
}
async function expectThrows(name, fn, codeMatch) {
  try {
    await fn();
    record(name, false, "expected an error but none thrown");
  } catch (e) {
    const msg = e.code || e.err_message || e.message || String(e);
    const ok = codeMatch ? String(msg).includes(codeMatch) : true;
    record(name, ok, `threw: ${msg}`);
  }
}

/* ------------------------------- fixtures -------------------------------- */
const FX = {
  customerId: null,
  ownerId: null,
  stationId: null,
  custAcctId: null,
  ownerAcctId: null,
};
let sysSnapshot = {};

async function snapshotSystemAccounts() {
  const [rows] = await q(
    `SELECT acct_id, acct_cd, blnce_amt FROM acct_lst_t WHERE acct_cd IN ('GATEWAY_RZP','PLATFORM_REVENUE','ESCROW_HOLD')`,
  );
  rows.forEach((r) => {
    sysSnapshot[r.acct_cd] = { acct_id: r.acct_id, blnce_amt: r.blnce_amt };
  });
}

async function setup() {
  const stamp = Date.now().toString().slice(-9);
  // unique phone numbers (15-char max col) and codes
  const [cust] = await q(
    `INSERT INTO usr_lst_t (phn_nmbr_tx, nm_tx, usr_typ_cd, a_in) VALUES (?, 'TEST Customer', 'customer', 1)`,
    [`9${stamp}1`],
  );
  FX.customerId = cust.insertId;
  const [own] = await q(
    `INSERT INTO usr_lst_t (phn_nmbr_tx, nm_tx, usr_typ_cd, a_in) VALUES (?, 'TEST Owner', 'owner', 1)`,
    [`9${stamp}2`],
  );
  FX.ownerId = own.insertId;
  const [stn] = await q(
    `INSERT INTO sttn_lst_t (ownr_usr_id, sttn_nm_tx, sttn_cd, addr_tx, prce_per_kwh_amt, a_in)
         VALUES (?, 'TEST Station', ?, 'Test address', 18.00, 1)`,
    [FX.ownerId, `TEST_${stamp}`],
  );
  FX.stationId = stn.insertId;

  await snapshotSystemAccounts();
  log(
    `\nFixtures: customer=${FX.customerId} owner=${FX.ownerId} station=${FX.stationId}`,
  );
}

async function resolveAccountIds() {
  const [[c]] = [
    await q(`SELECT acct_id FROM acct_lst_t WHERE acct_cd = ?`, [
      `WALLET_${FX.customerId}`,
    ]),
  ].map((r) => r[0]);
  if (c) FX.custAcctId = c.acct_id;
  const [[o]] = [
    await q(`SELECT acct_id FROM acct_lst_t WHERE acct_cd = ?`, [
      `OWNER_${FX.ownerId}`,
    ]),
  ].map((r) => r[0]);
  if (o) FX.ownerAcctId = o.acct_id;
}

async function cleanup() {
  log("\nCleaning up test data...");
  try {
    await resolveAccountIds();
    const testAccts = [FX.custAcctId, FX.ownerAcctId].filter(Boolean);
    if (testAccts.length) {
      const [jrows] = await q(
        `SELECT DISTINCT jrnl_id FROM jrnl_leg_lst_t WHERE acct_id IN (${testAccts.map(() => "?").join(",")})`,
        testAccts,
      );
      const jids = jrows.map((r) => r.jrnl_id);
      if (jids.length) {
        await q(
          `DELETE FROM jrnl_leg_lst_t WHERE jrnl_id IN (${jids.map(() => "?").join(",")})`,
          jids,
        );
        await q(
          `DELETE FROM jrnl_lst_t WHERE jrnl_id IN (${jids.map(() => "?").join(",")})`,
          jids,
        );
      }
    }
    const users = [FX.customerId, FX.ownerId].filter(Boolean);
    if (users.length) {
      const ph = users.map(() => "?").join(",");
      await q(`DELETE FROM trxn_lst_t WHERE usr_id IN (${ph})`, users);
      await q(`DELETE FROM audt_lst_t WHERE usr_id IN (${ph})`, users);
      await q(
        `DELETE FROM acct_lst_t WHERE usr_id IN (${ph}) OR ownr_usr_id IN (${ph})`,
        [...users, ...users],
      );
      await q(`DELETE FROM wllt_lst_t WHERE usr_id IN (${ph})`, users);
    }
    if (FX.stationId) {
      await q(`DELETE FROM cmsn_rule_lst_t WHERE sttn_id = ?`, [FX.stationId]);
      await q(`DELETE FROM sttn_lst_t WHERE sttn_id = ?`, [FX.stationId]);
    }
    if (users.length) {
      await q(
        `DELETE FROM usr_lst_t WHERE usr_id IN (${users.map(() => "?").join(",")})`,
        users,
      );
    }
    // Restore system account cached balances to the pre-test snapshot.
    for (const cd of Object.keys(sysSnapshot)) {
      await q(`UPDATE acct_lst_t SET blnce_amt = ? WHERE acct_id = ?`, [
        sysSnapshot[cd].blnce_amt,
        sysSnapshot[cd].acct_id,
      ]);
    }
    log("   ✓ cleanup done");
  } catch (e) {
    log("   ⚠️ cleanup error: " + (e.message || e));
  }
}

/* ---- invariant helpers (scoped to this test's accounts) ---- */
async function journalIsBalanced(jrnlId) {
  const [[r]] = [
    await q(
      `SELECT
            ROUND(SUM(CASE WHEN drct_cd='debit'  THEN amt ELSE 0 END),2) AS d,
            ROUND(SUM(CASE WHEN drct_cd='credit' THEN amt ELSE 0 END),2) AS c
         FROM jrnl_leg_lst_t WHERE jrnl_id = ?`,
      [jrnlId],
    ),
  ].map((x) => x[0]);
  return approx(r.d, r.c);
}

/* -------------------------------- cases ---------------------------------- */
async function runCases() {
  const C = FX.customerId,
    O = FX.ownerId,
    S = FX.stationId;

  // 1) Wallet top-up
  log("\n[1] Wallet top-up");
  const t1 = await ledger.walletTopup({
    userId: C,
    amount: 1000,
    paymentMethod: "upi",
    idempotencyKey: `test:topup:${C}:1`,
  });
  await expectEq(
    "top-up credits wallet to 1000",
    await ledger.getWalletBalance(C),
    1000,
  );
  await expectTrue(
    "top-up journal is balanced",
    await journalIsBalanced(t1.jrnlId),
  );

  // 2) Idempotent top-up (same key) must not double-credit
  log("\n[2] Idempotency");
  const t2 = await ledger.walletTopup({
    userId: C,
    amount: 1000,
    paymentMethod: "upi",
    idempotencyKey: `test:topup:${C}:1`,
  });
  await expectTrue("repeat returns idempotent flag", t2.idempotent === true);
  await expectEq(
    "balance unchanged after repeat",
    await ledger.getWalletBalance(C),
    1000,
  );

  // 3) Charging hold (escrow)
  log("\n[3] Charging hold");
  await ledger.chargingHold({ userId: C, sessionId: 5001, amount: 200 });
  await expectEq(
    "wallet reduced by hold -> 800",
    await ledger.getWalletBalance(C),
    800,
  );

  // 4) Insufficient funds
  log("\n[4] Insufficient funds");
  await expectThrows(
    "hold beyond balance throws INSUFFICIENT_FUNDS",
    () => ledger.chargingHold({ userId: C, sessionId: 5002, amount: 5000 }),
    "INSUFFICIENT_FUNDS",
  );
  await expectEq(
    "balance unchanged after failed hold",
    await ledger.getWalletBalance(C),
    800,
  );

  // 5) Partial settle: hold 200, consume 150 -> owner 120 / platform 30 / refund 50
  log("\n[5] Partial settle + refund (80/20)");
  const ownerBefore = await ledger.getOwnerBalance(O);
  const s5 = await ledger.chargingSettle({
    userId: C,
    sessionId: 5001,
    stationId: S,
    ownerUserId: O,
    holdAmount: 200,
    consumedAmount: 150,
  });
  await expectEq(
    "owner receives 80% of 150 = 120",
    (await ledger.getOwnerBalance(O)) - ownerBefore,
    120,
  );
  await expectEq(
    "refund of 50 returns wallet to 850",
    await ledger.getWalletBalance(C),
    850,
  );
  await expectTrue(
    "settle payment journal balanced",
    await journalIsBalanced(s5.payment.jrnlId),
  );
  await expectTrue(
    "settle refund journal balanced",
    await journalIsBalanced(s5.refund.jrnlId),
  );
  await expectEq("reported consumed", s5.consumedAmount, 150);
  await expectEq("reported refund", s5.refundAmount, 50);

  // 6) Full settle: hold 300, consume 300 -> no refund
  log("\n[6] Full settle (no refund)");
  await ledger.chargingHold({ userId: C, sessionId: 5003, amount: 300 }); // wallet 850 -> 550
  const ownerBefore6 = await ledger.getOwnerBalance(O);
  const s6 = await ledger.chargingSettle({
    userId: C,
    sessionId: 5003,
    stationId: S,
    ownerUserId: O,
    holdAmount: 300,
    consumedAmount: 300,
  });
  await expectEq(
    "wallet stays 550 (no refund)",
    await ledger.getWalletBalance(C),
    550,
  );
  await expectEq(
    "owner gains 240 (80% of 300)",
    (await ledger.getOwnerBalance(O)) - ownerBefore6,
    240,
  );
  await expectTrue("no refund journal on full settle", s6.refund === null);

  // 7) Cancel: hold then cancel -> full refund
  log("\n[7] Cancel hold (full refund)");
  await ledger.chargingHold({ userId: C, sessionId: 5004, amount: 100 }); // 550 -> 450
  await expectEq(
    "wallet 450 after hold",
    await ledger.getWalletBalance(C),
    450,
  );
  await ledger.chargingCancel({ userId: C, sessionId: 5004, holdAmount: 100 });
  await expectEq(
    "wallet restored to 550 after cancel",
    await ledger.getWalletBalance(C),
    550,
  );

  // 8) Rounding: consume 99.99 @ 80/20 -> owner 79.99 + platform 20.00 == 99.99 exactly
  log("\n[8] Rounding correctness");
  const split = ledger.splitConsumed(99.99, 80, 20);
  await expectEq("owner share 79.99", split.ownerAmount, 79.99);
  await expectEq("platform share 20.00", split.platformAmount, 20.0);
  await expectEq(
    "owner+platform == 99.99",
    split.ownerAmount + split.platformAmount,
    99.99,
  );

  // 9) Per-station commission override (70/30)
  log("\n[9] Per-station commission override 70/30");
  await q(
    `INSERT INTO cmsn_rule_lst_t (scope_cd, sttn_id, ownr_pct, platfrm_pct, prirty_nbr, a_in)
             VALUES ('station', ?, 70.00, 30.00, 10, 1)`,
    [S],
  );
  await ledger.chargingHold({ userId: C, sessionId: 5005, amount: 100 }); // 550 -> 450
  const ownerBefore9 = await ledger.getOwnerBalance(O);
  const s9 = await ledger.chargingSettle({
    userId: C,
    sessionId: 5005,
    stationId: S,
    ownerUserId: O,
    holdAmount: 100,
    consumedAmount: 100,
  });
  await expectEq(
    "station override gives owner 70",
    (await ledger.getOwnerBalance(O)) - ownerBefore9,
    70,
  );
  await expectTrue(
    "override resolved as station scope",
    s9.commission.scope === "station",
  );

  // 10) Double-entry shape: charging_payment has 1 debit (escrow) + 2 credits (owner+platform)
  log("\n[10] Double-entry from->to shape");
  const [legs] = await q(
    `SELECT l.drct_cd, a.acct_typ_cd, l.amt
           FROM jrnl_leg_lst_t l JOIN acct_lst_t a ON a.acct_id = l.acct_id
          WHERE l.jrnl_id = ?`,
    [s9.payment.jrnlId],
  );
  const debits = legs.filter((l) => l.drct_cd === "debit");
  const credits = legs.filter((l) => l.drct_cd === "credit");
  await expectTrue(
    "one debit leg (from escrow)",
    debits.length === 1 && debits[0].acct_typ_cd === "escrow_hold",
  );
  await expectTrue(
    "two credit legs (to owner + platform)",
    credits.length === 2,
  );

  // 11) Payout reduces owner balance; overdraw blocked
  log("\n[11] Owner payout + overdraw guard");
  const ownerBal = await ledger.getOwnerBalance(O);
  await ledger.payout({
    ownerUserId: O,
    amount: 50,
    idempotencyKey: `test:payout:${O}:1`,
  });
  await expectEq(
    "payout reduces owner balance by 50",
    await ledger.getOwnerBalance(O),
    ownerBal - 50,
  );
  await expectThrows(
    "payout beyond balance blocked",
    () =>
      ledger.payout({
        ownerUserId: O,
        amount: 999999,
        idempotencyKey: `test:payout:${O}:2`,
      }),
    "INSUFFICIENT_FUNDS",
  );

  // 12) Legacy wallet cache stays in sync with the ledger
  log("\n[12] Legacy wallet cache sync");
  const [[w]] = [
    await q(`SELECT blnce_amt FROM wllt_lst_t WHERE usr_id = ?`, [C]),
  ].map((r) => r[0]);
  await expectEq(
    "wllt_lst_t mirrors ledger wallet balance",
    parseFloat(w.blnce_amt),
    await ledger.getWalletBalance(C),
  );
  const [[tx]] = [
    await q(`SELECT COUNT(*) AS n FROM trxn_lst_t WHERE usr_id = ?`, [C]),
  ].map((r) => r[0]);
  await expectTrue(
    "trxn_lst_t statement rows were mirrored",
    tx.n > 0,
    `${tx.n} rows`,
  );

  // 13) Audit trail — every money movement writes an audt_lst_t row linked to its journal
  log("\n[13] Audit trail (audt_lst_t)");
  const [[au]] = [
    await q(
      `SELECT COUNT(*) AS n FROM audt_lst_t WHERE usr_id = ? AND entty_typ_cd = 'journal'`,
      [C],
    ),
  ].map((r) => r[0]);
  await expectTrue(
    "audit rows written for customer movements",
    au.n > 0,
    `${au.n} audit rows`,
  );
  const [[auActions]] = [
    await q(
      `SELECT COUNT(DISTINCT actn_cd) AS n FROM audt_lst_t WHERE usr_id = ?`,
      [C],
    ),
  ].map((r) => r[0]);
  await expectTrue(
    "audit captures multiple action types",
    auActions.n >= 3,
    `${auActions.n} distinct actions`,
  );
  // audit entty_id must point at a real journal we can read back
  const [[auLink]] = [
    await q(
      `SELECT a.entty_id FROM audt_lst_t a
           JOIN jrnl_lst_t j ON j.jrnl_id = a.entty_id
          WHERE a.usr_id = ? AND a.entty_typ_cd = 'journal' LIMIT 1`,
      [C],
    ),
  ].map((r) => r[0]);
  await expectTrue("audit row links to a real journal entry", !!auLink);
}

/* --------------------------------- main ---------------------------------- */
(async () => {
  log("================ PAYMENT LEDGER TEST RUN ================");
  log("Started: " + new Date().toISOString());
  let setupOk = false;
  try {
    await setup();
    setupOk = true;
    await runCases();
  } catch (e) {
    log("\n💥 Unexpected error during run: " + (e.stack || e.message || e));
    record("unexpected error", false, e.message || String(e));
  } finally {
    if (setupOk) await cleanup();
  }

  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  log("\n========================================================");
  log(`RESULT: ${passed}/${results.length} passed, ${failed} failed`);
  log("Finished: " + new Date().toISOString());

  // Write timestamped log file
  try {
    const dir = path.resolve(__dirname, "results");
    fs.mkdirSync(dir, { recursive: true });
    const fname = `ledger-${new Date().toISOString().replace(/[:.]/g, "-")}.log`;
    fs.writeFileSync(path.join(dir, fname), logLines.join("\n") + "\n");
    fs.writeFileSync(path.join(dir, "latest.log"), logLines.join("\n") + "\n");
    log(`\nLog written: tests/payment/results/${fname}`);
  } catch (e) {
    log("Could not write log file: " + (e.message || e));
  }

  try {
    await pool.end();
  } catch (_) {}
  process.exit(failed === 0 ? 0 : 1);
})();
