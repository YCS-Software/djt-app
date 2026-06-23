/**
 * Payment Gateway + Double-Entry Ledger — Playwright HTTP integration simulation.
 *
 *   node tests/payment/playwright/payment.sim.js
 *
 * Unlike tests/payment/ledger.test.js (which calls the ledger service in-process),
 * this drives the LIVE Express server over HTTP through Playwright's request API,
 * exercising the real auth middleware, controllers, signature verification and the
 * public Razorpay webhook.
 *
 * NO MOCK MODE
 * ------------
 * The app has no mock fallback (config/razorpay.config.js exposes isConfigured(),
 * NOT isMockMode). Payments always go through the real Razorpay gateway, which means
 * `/payment/create-order` makes a live API call and returns 502 if the configured
 * keys are rejected. We probe that endpoint ONCE and merely RECORD the outcome
 * (order_id vs 502) — it is not a hard failure either way.
 *
 * Signature verification (`/payment/verify` and the webhook) is a LOCAL HMAC with the
 * secret, so the verify+credit path can be exercised deterministically WITHOUT a valid
 * Razorpay account: we insert a `pay_ordr_lst_t` row directly via `pool` to simulate the
 * order Razorpay would have created, then compute the signature ourselves
 * (HMAC_SHA256(order_id|payment_id, RAZORPAY_SECRET_KEY)) and POST it to /verify.
 *
 * Scenarios:
 *   0. create-order probe        (record order_id or 502, never fail)
 *   1. Top-up (signed)           verify -> verified, balance rises, ledger reflects it
 *   2. Idempotent verify         second verify -> already_processed, balance unchanged
 *   3. Invalid signature         tampered sig -> 400, not credited
 *   4. Missing fields            /verify without payment_id / signature -> 400
 *   5. Webhook reconciliation    payment.captured -> credited; replay no-op; bad sig 401
 *   6. Auth required             protected endpoint without/with bad token -> 401
 *   7. Ledger trail              journal balanced (Sigma dr == Sigma cr) + audt_lst_t row
 *
 * It cleans up EVERY row it created and restores the 3 system-account balances.
 * Exit code is non-zero if any case fails.
 *
 * The server must already be running on :5000, started with a known
 * RAZORPAY_WEBHOOK_SECRET (see README). Required env:
 *   BASE_URL                  (default http://localhost:5000)
 *   RAZORPAY_WEBHOOK_SECRET   MUST match the secret the server was started with
 *   RAZORPAY_SECRET_KEY, JWT_SECRET, DB creds  (from .env)
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

global.appRoot = path.resolve(__dirname, '../../..');

const { request } = require('playwright');
const dbcfg = require(appRoot + '/config/db.config');
const pool = dbcfg.pool;

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || '';
const KEY_SECRET = process.env.RAZORPAY_SECRET_KEY || process.env.RAZORPAY_KEY_SECRET || '';
const JWT_SECRET = process.env.JWT_SECRET;

const q = (sql, params) => pool.query(sql, params);

/* --------------------------- tiny test harness --------------------------- */
const results = [];
const logLines = [];
function log(line) { console.log(line); logLines.push(String(line)); }
function record(name, ok, detail) {
    results.push({ name, ok, detail });
    log(`${ok ? '  PASS' : '  FAIL'} - ${name}${detail ? `  (${detail})` : ''}`);
}
// A pure observation that never counts as pass/fail (used for the create-order probe).
function note(line) { log(`  NOTE - ${line}`); }
function approx(a, b, eps = 0.005) { return Math.abs(Number(a) - Number(b)) < eps; }
function expectEq(name, actual, expected) { record(name, approx(actual, expected), `expected ${expected}, got ${actual}`); }
function expectTrue(name, cond, detail) { record(name, !!cond, detail); }

/* ----- signature helpers (mirror config/razorpay.config.js) ----- */
function checkoutSignature(orderId, paymentId) {
    return crypto.createHmac('sha256', KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');
}
function webhookSignature(rawBody) {
    return crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');
}

/* ------------------------------- fixtures -------------------------------- */
const FX = { customerId: null, custAcctId: null, token: null };
let sysSnapshot = {};
const createOrderProbe = { status: null, orderId: null, gatewayAccepted: null };

async function snapshotSystemAccounts() {
    const [rows] = await q(`SELECT acct_id, acct_cd, blnce_amt FROM acct_lst_t WHERE acct_cd IN ('GATEWAY_RZP','PLATFORM_REVENUE','ESCROW_HOLD')`);
    rows.forEach(r => { sysSnapshot[r.acct_cd] = { acct_id: r.acct_id, blnce_amt: r.blnce_amt }; });
}

async function setup() {
    const stamp = Date.now().toString().slice(-9);
    const [cust] = await q(
        `INSERT INTO usr_lst_t (phn_nmbr_tx, nm_tx, usr_typ_cd, a_in) VALUES (?, 'TEST PW Customer', 'customer', 1)`,
        [`8${stamp}1`]);
    FX.customerId = cust.insertId;
    FX.token = jwt.sign({ userId: FX.customerId, userType: 'customer' }, JWT_SECRET, { expiresIn: '1h' });
    await snapshotSystemAccounts();
    log(`\nFixtures: customer=${FX.customerId}  baseURL=${BASE_URL}`);
    log(`Razorpay secret configured for signing: ${KEY_SECRET ? 'yes' : 'NO'}`);
    log(`Webhook secret configured for signing: ${WEBHOOK_SECRET ? 'yes' : 'NO'}`);
}

async function resolveCustAcct() {
    const [rows] = await q(`SELECT acct_id FROM acct_lst_t WHERE acct_cd = ?`, [`WALLET_${FX.customerId}`]);
    if (rows[0]) FX.custAcctId = rows[0].acct_id;
}

async function cleanup() {
    log('\nCleaning up test data...');
    try {
        await resolveCustAcct();
        const testAccts = [FX.custAcctId].filter(Boolean);
        if (testAccts.length) {
            const [jrows] = await q(
                `SELECT DISTINCT jrnl_id FROM jrnl_leg_lst_t WHERE acct_id IN (${testAccts.map(() => '?').join(',')})`,
                testAccts);
            const jids = jrows.map(r => r.jrnl_id);
            if (jids.length) {
                await q(`DELETE FROM jrnl_leg_lst_t WHERE jrnl_id IN (${jids.map(() => '?').join(',')})`, jids);
                await q(`DELETE FROM jrnl_lst_t WHERE jrnl_id IN (${jids.map(() => '?').join(',')})`, jids);
            }
        }
        const users = [FX.customerId].filter(Boolean);
        if (users.length) {
            const ph = users.map(() => '?').join(',');
            // payment orders this user created (also gives us rzp order ids for webhook rows)
            const [orows] = await q(`SELECT rzrpy_ordr_id_tx FROM pay_ordr_lst_t WHERE usr_id IN (${ph})`, users);
            const orderIds = orows.map(r => r.rzrpy_ordr_id_tx).filter(Boolean);
            if (orderIds.length) {
                await q(`DELETE FROM pay_wbhk_lst_t WHERE rzrpy_ordr_id_tx IN (${orderIds.map(() => '?').join(',')})`, orderIds);
            }
            await q(`DELETE FROM pay_ordr_lst_t WHERE usr_id IN (${ph})`, users);
            await q(`DELETE FROM trxn_lst_t WHERE usr_id IN (${ph})`, users);
            await q(`DELETE FROM audt_lst_t WHERE usr_id IN (${ph})`, users);
            await q(`DELETE FROM acct_lst_t WHERE usr_id IN (${ph}) OR ownr_usr_id IN (${ph})`, [...users, ...users]);
            await q(`DELETE FROM wllt_lst_t WHERE usr_id IN (${ph})`, users);
            await q(`DELETE FROM usr_lst_t WHERE usr_id IN (${ph})`, users);
        }
        // Restore system account cached balances to the pre-test snapshot.
        for (const cd of Object.keys(sysSnapshot)) {
            await q(`UPDATE acct_lst_t SET blnce_amt = ? WHERE acct_id = ?`,
                [sysSnapshot[cd].blnce_amt, sysSnapshot[cd].acct_id]);
        }
        log('   cleanup done');
    } catch (e) {
        log('   cleanup error: ' + (e.message || e));
    }
}

/* ----- DB invariant helpers ----- */
async function journalBalanced(jrnlId) {
    const [rows] = await q(
        `SELECT ROUND(SUM(CASE WHEN drct_cd='debit'  THEN amt ELSE 0 END),2) AS d,
                ROUND(SUM(CASE WHEN drct_cd='credit' THEN amt ELSE 0 END),2) AS c
           FROM jrnl_leg_lst_t WHERE jrnl_id = ?`, [jrnlId]);
    return approx(rows[0].d, rows[0].c);
}

/**
 * Simulate the order Razorpay would have created by inserting a pay_ordr_lst_t row
 * directly. Returns the synthetic razorpay order id.
 */
async function simulateOrder(amount) {
    const orderId = `order_sim_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    await q(
        `INSERT INTO pay_ordr_lst_t
            (usr_id, rzrpy_ordr_id_tx, amt, crncy_cd, purpose_cd, pymnt_mthd_cd, sttus_cd, is_mock_in, a_in, i_ts)
         VALUES (?, ?, ?, 'INR', 'wallet_topup', 'upi', 'created', 0, 1, NOW())`,
        [FX.customerId, orderId, amount]);
    return orderId;
}

/* ----- HTTP helpers ----- */
function authHdr() { return { 'x-access-token': FX.token }; }

async function walletBalance(ctx) {
    const res = await ctx.get('/api/ledger/accounts', { headers: authHdr() });
    const body = (await res.json()).data || {};
    const wallet = (body.accounts || []).find(a => a.account_code === `WALLET_${FX.customerId}`);
    return { wallet, balance: wallet ? wallet.balance : 0 };
}

/* -------------------------------- cases ---------------------------------- */
async function runCases(ctx) {
    // ---------- Scenario 0: create-order probe (record-only) ----------
    log('\n[0] create-order probe (records gateway outcome; never fails the run)');
    {
        const res = await ctx.post('/api/payment/create-order', {
            headers: authHdr(),
            data: { amount: 500, currency: 'INR', payment_method: 'upi' },
        });
        const status = res.status();
        let body = {};
        try { body = await res.json(); } catch (_) {}
        const orderId = body && body.data && body.data.order_id;
        createOrderProbe.status = status;
        createOrderProbe.orderId = orderId || null;
        createOrderProbe.gatewayAccepted = !!orderId;
        if (orderId) {
            note(`create-order returned an order_id (gateway keys accepted): ${orderId} status=${status}`);
        } else if (status === 502) {
            note(`create-order returned 502 (gateway rejected the configured test keys) — expected, not a failure`);
        } else {
            note(`create-order returned status=${status} body=${JSON.stringify(body).slice(0, 200)}`);
        }
        // Sanity record that always passes: the endpoint either created an order or
        // cleanly reported a gateway error (anything but a 5xx-crash / 401).
        expectTrue('create-order responded (200 order or 502 gateway-reject)',
            status === 200 || status === 502,
            `status=${status} order_id=${orderId || 'none'}`);
    }

    // ---------- Scenario 1: Top-up (signed) ----------
    log('\n[1] Top-up (simulate order, sign, verify -> balance rises)');
    const TOPUP = 500;
    const orderId1 = await simulateOrder(TOPUP);
    const payId1 = `pay_sim_${Date.now()}`;
    const sig1 = checkoutSignature(orderId1, payId1);

    const v1 = await ctx.post('/api/payment/verify', {
        headers: authHdr(),
        data: { razorpay_order_id: orderId1, razorpay_payment_id: payId1, razorpay_signature: sig1 },
    });
    const v1b = (await v1.json()).data || {};
    expectTrue('verify returns 200 + verified', v1.status() === 200 && v1b.verified === true,
        `status=${v1.status()} verified=${v1b.verified}`);
    expectEq('new_balance rose by top-up amount', v1b.new_balance, TOPUP);
    const journalId1 = v1b.journal_id;
    expectTrue('verify returned a journal_id', !!journalId1, `journal_id=${journalId1}`);

    const acc1 = await walletBalance(ctx);
    expectTrue('ledger/accounts lists the wallet account', !!acc1.wallet, `found=${!!acc1.wallet}`);
    expectEq('ledger/accounts wallet balance == top-up', acc1.balance, TOPUP);

    // ---------- Scenario 2: Idempotent verify ----------
    log('\n[2] Idempotent verify (second verify does not double-credit)');
    const v2 = await ctx.post('/api/payment/verify', {
        headers: authHdr(),
        data: { razorpay_order_id: orderId1, razorpay_payment_id: payId1, razorpay_signature: sig1 },
    });
    const v2b = (await v2.json()).data || {};
    expectTrue('repeat verify flags already_processed', v2b.already_processed === true, `already_processed=${v2b.already_processed}`);
    expectEq('balance unchanged after repeat verify', v2b.new_balance, TOPUP);

    // ---------- Scenario 3: Invalid signature ----------
    log('\n[3] Invalid signature -> 400, not credited');
    {
        const balBefore = (await walletBalance(ctx)).balance;
        const orderId3 = await simulateOrder(300);
        const badPayId = `pay_sim_${Date.now()}`;
        const v3 = await ctx.post('/api/payment/verify', {
            headers: authHdr(),
            data: { razorpay_order_id: orderId3, razorpay_payment_id: badPayId, razorpay_signature: 'deadbeefbadsignature' },
        });
        expectTrue('tampered signature -> 400', v3.status() === 400, `status=${v3.status()}`);
        const balAfter = (await walletBalance(ctx)).balance;
        expectEq('balance unchanged after bad signature', balAfter, balBefore);
    }

    // ---------- Scenario 4: Missing fields ----------
    log('\n[4] Missing fields on /verify -> 400');
    {
        const orderId4 = await simulateOrder(100);
        const noPay = await ctx.post('/api/payment/verify', {
            headers: authHdr(),
            data: { razorpay_order_id: orderId4, razorpay_signature: 'whatever' },
        });
        expectTrue('verify without payment_id -> 400', noPay.status() === 400, `status=${noPay.status()}`);
        const noSig = await ctx.post('/api/payment/verify', {
            headers: authHdr(),
            data: { razorpay_order_id: orderId4, razorpay_payment_id: `pay_sim_${Date.now()}` },
        });
        expectTrue('verify without signature -> 400', noSig.status() === 400, `status=${noSig.status()}`);
    }

    // ---------- Scenario 5: Webhook reconciliation ----------
    log('\n[5] Webhook reconciliation (payment.captured credits wallet; replay no-op; bad sig 401)');
    if (!WEBHOOK_SECRET) {
        record('webhook credits wallet', false, 'no RAZORPAY_WEBHOOK_SECRET set for signing — server cannot verify');
    } else {
        const WH_AMOUNT = 250;
        const orderId5 = await simulateOrder(WH_AMOUNT);
        const eventId = `evt_test_${FX.customerId}_${Date.now()}`;
        const payId5 = `pay_wh_${Date.now()}`;
        const payload = {
            event: 'payment.captured',
            payload: { payment: { entity: { id: payId5, order_id: orderId5, amount: WH_AMOUNT * 100, currency: 'INR', status: 'captured' } } },
        };
        const raw = JSON.stringify(payload);
        const sig = webhookSignature(raw);

        const beforeWh = (await walletBalance(ctx)).balance;

        const wh1 = await ctx.post('/api/ledger/webhook/razorpay', {
            headers: { 'x-razorpay-signature': sig, 'x-razorpay-event-id': eventId, 'content-type': 'application/json' },
            data: raw,
        });
        expectTrue('webhook accepted (200)', wh1.status() === 200, `status=${wh1.status()}`);

        const afterWh = (await walletBalance(ctx)).balance;
        expectEq('webhook credited wallet by amount', afterWh - beforeWh, WH_AMOUNT);

        // Replay same event id -> idempotent no-op
        const wh2 = await ctx.post('/api/ledger/webhook/razorpay', {
            headers: { 'x-razorpay-signature': sig, 'x-razorpay-event-id': eventId, 'content-type': 'application/json' },
            data: raw,
        });
        const wh2b = (await wh2.json()).data || {};
        const afterReplay = (await walletBalance(ctx)).balance;
        expectTrue('webhook replay reported already-processed', wh2b && wh2b.already === true, `data=${JSON.stringify(wh2b)}`);
        expectEq('webhook replay did not double-credit', afterReplay, afterWh);

        // bad-signature webhook rejected
        const wh3 = await ctx.post('/api/ledger/webhook/razorpay', {
            headers: { 'x-razorpay-signature': 'bad', 'x-razorpay-event-id': `evt_bad_${Date.now()}`, 'content-type': 'application/json' },
            data: raw,
        });
        expectTrue('bad webhook signature rejected (401)', wh3.status() === 401, `status=${wh3.status()}`);
    }

    // ---------- Scenario 6: Auth required ----------
    log('\n[6] Auth required on protected endpoints');
    const noTok = await ctx.get('/api/ledger/accounts');
    expectTrue('no token -> 401', noTok.status() === 401, `status=${noTok.status()}`);
    const badTok = await ctx.get('/api/ledger/accounts', { headers: { 'x-access-token': 'not.a.jwt' } });
    expectTrue('invalid token -> 401', badTok.status() === 401, `status=${badTok.status()}`);
    const noTokPay = await ctx.post('/api/payment/create-order', { data: { amount: 100 } });
    expectTrue('create-order without token -> 401', noTokPay.status() === 401, `status=${noTokPay.status()}`);

    // ---------- Scenario 7: Ledger trail ----------
    log('\n[7] Ledger trail (journal balanced + audit row exists)');
    if (journalId1) {
        const jRes = await ctx.get(`/api/ledger/journals/${journalId1}`, { headers: authHdr() });
        const jBody = (await jRes.json()).data || {};
        expectTrue('journal fetch returns 200', jRes.status() === 200, `status=${jRes.status()}`);
        const legs = jBody.legs || [];
        const sumDr = legs.filter(l => l.direction === 'debit').reduce((s, l) => s + l.amount, 0);
        const sumCr = legs.filter(l => l.direction === 'credit').reduce((s, l) => s + l.amount, 0);
        expectTrue('journal balanced via API (Sigma debit == Sigma credit)', approx(sumDr, sumCr), `dr=${sumDr} cr=${sumCr}`);
        expectTrue('journal balanced via DB', await journalBalanced(journalId1));

        const [au] = await q(
            `SELECT COUNT(*) AS n FROM audt_lst_t WHERE usr_id = ? AND entty_typ_cd = 'journal' AND entty_id = ?`,
            [FX.customerId, journalId1]);
        expectTrue('matching audt_lst_t row exists for journal', au[0].n > 0, `${au[0].n} audit rows`);
    } else {
        record('ledger trail', false, 'no journal_id from scenario 1');
    }
}

/* --------------------------------- main ---------------------------------- */
(async () => {
    log('============ PAYMENT PLAYWRIGHT SIMULATION (no-mock) ============');
    log('Started: ' + new Date().toISOString());
    let setupOk = false;
    let ctx;
    try {
        ctx = await request.newContext({ baseURL: BASE_URL });
        // Sanity: server reachable
        const health = await ctx.get('/api/health');
        if (health.status() !== 200) throw new Error(`Server health check failed: status ${health.status()}`);
        await setup();
        setupOk = true;
        await runCases(ctx);
    } catch (e) {
        log('\nUnexpected error during run: ' + (e.stack || e.message || e));
        record('unexpected error', false, e.message || String(e));
    } finally {
        if (setupOk) await cleanup();
        if (ctx) { try { await ctx.dispose(); } catch (_) {} }
    }

    const passed = results.filter(r => r.ok).length;
    const failed = results.length - passed;
    log('\n================================================================');
    log(`create-order probe: ${createOrderProbe.gatewayAccepted ? 'gateway ACCEPTED (order ' + createOrderProbe.orderId + ')' : 'gateway REJECTED (status ' + createOrderProbe.status + ')'}`);
    log(`RESULT: ${passed}/${results.length} passed, ${failed} failed`);
    log('Finished: ' + new Date().toISOString());

    try {
        const dir = path.resolve(__dirname, 'results');
        fs.mkdirSync(dir, { recursive: true });
        const fname = `payment-sim-${new Date().toISOString().replace(/[:.]/g, '-')}.log`;
        fs.writeFileSync(path.join(dir, fname), logLines.join('\n') + '\n');
        fs.writeFileSync(path.join(dir, 'latest.log'), logLines.join('\n') + '\n');
        log(`\nLog written: tests/payment/playwright/results/${fname}`);
    } catch (e) {
        log('Could not write log file: ' + (e.message || e));
    }

    try { await pool.end(); } catch (_) {}
    process.exit(failed === 0 ? 0 : 1);
})();
