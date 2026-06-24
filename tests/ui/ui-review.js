/**
 * Headed Playwright visual review of the four UI fixes.
 *
 *   node tests/ui/ui-review.js
 *
 * Opens a real Chromium window and walks the screens, taking screenshots:
 *   1. Wallet success TOAST (styled, replaces the plain alert)
 *   2. Owner station-detail — compact "Station Details" rows
 *   3. Nearby Stations — centered header
 *   4. StationMap — full-screen modal (portal)
 *
 * Safe & self-contained: the wallet payment endpoints are MOCKED in the browser
 * (no real Razorpay, no money, no DB writes). The other screens are read-only GETs
 * against the existing backend. Auth is injected via a minted JWT (no OTP).
 * Uses existing servers: frontend :3000 -> backend :5000.
 */

const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { chromium } = require('playwright');

const FRONTEND = process.env.FRONTEND_URL || 'http://localhost:3000';
const SHOTS = path.resolve(__dirname, 'results');
const CUSTOMER_USER_ID = 3;   // existing customer (read-only use for station GETs)
const OWNER_STATION_ID = 4;   // SAIEVSTATION
const OWNER_USER_ID = 1;

const log = (m) => console.log(m);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function token(userId, userType) {
  return jwt.sign({ userId, userType }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

async function authedContext(browser, tok, user) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 900 } });
  await ctx.addInitScript(([t, u]) => {
    localStorage.setItem('x-access-token', t);
    localStorage.setItem('user', u);
  }, [tok, JSON.stringify(user)]);
  return ctx;
}

// Mock the wallet/payment endpoints so the success path runs with no real gateway.
async function mockWalletApi(ctx) {
  const ok = (data) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 200, message: 'ok', data }) });
  await ctx.route(/\/api\/wallet\/balance/, (r) => r.fulfill(ok({ wallet_id: 1, balance: 500, last_updated: '2026-06-24T00:00:00.000Z' })));
  await ctx.route(/\/api\/wallet\/transactions/, (r) => r.fulfill(ok({
    transactions: [{ trxn_id: 1, type: 'credit', category: 'topup', amount: 500, balance_before: 0, balance_after: 500, description: 'Wallet top-up via razorpay', payment_method: 'razorpay', status: 'completed', created_at: '2026-06-24T00:00:00.000Z' }],
    total: 1, limit: 50, offset: 0,
  })));
  await ctx.route(/\/api\/payment\/create-order/, (r) => r.fulfill(ok({ order_id: 'order_uireview', amount: 500, currency: 'INR', key_id: 'rzp_test_demo' })));
  await ctx.route(/\/api\/payment\/verify/, (r) => r.fulfill(ok({ verified: true, order_id: 'order_uireview', payment_id: 'pay_uireview', new_balance: 500 })));
  // Block real Razorpay checkout.js and stub the SDK so .open() fires the handler path.
  await ctx.route(/checkout\.razorpay\.com/, (r) => r.abort());
  await ctx.addInitScript(() => {
    window.Razorpay = function (opts) { window.__rzpOpts = opts; return { open: function () { window.__rzpOpened = true; }, on: function () {} }; };
  });
}

async function run() {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({ headless: false, slowMo: 350 });
  const results = [];
  try {
    // ---------- Customer screens ----------
    const ctx = await authedContext(browser, token(CUSTOMER_USER_ID, 'customer'),
      { usr_id: CUSTOMER_USER_ID, name: 'UI Review', mobile: '9999999997', email: '', usr_typ_cd: 'customer' });
    await mockWalletApi(ctx);
    const page = await ctx.newPage();

    // (1) Wallet success toast
    log('\n[1] Wallet success toast');
    await page.goto(`${FRONTEND}/wallet`, { waitUntil: 'domcontentloaded' });
    await page.locator('.balance-amount .amount').first().waitFor({ timeout: 15000 });
    await page.getByRole('button', { name: 'Add Money' }).first().click();
    await page.getByPlaceholder('0').first().fill('500');
    await page.getByRole('button', { name: /Add\s*₹/ }).first().click();
    // Drive the stubbed checkout handler -> finishTopup -> (mocked) verify -> success toast.
    await page.waitForFunction(() => !!window.__rzpOpts, null, { timeout: 8000 });
    await page.evaluate(() => window.__rzpOpts.handler({ razorpay_order_id: 'order_uireview', razorpay_payment_id: 'pay_uireview', razorpay_signature: 'sig_demo' }));
    await page.locator('.wallet-toast').waitFor({ timeout: 10000 });
    await sleep(700);
    await page.screenshot({ path: path.join(SHOTS, '1-wallet-toast.png') });
    results.push(['Wallet success toast styled (not a plain alert)', await page.locator('.wallet-toast-success').count() > 0]);

    // (3) Nearby Stations — centered header
    log('[3] Nearby Stations header');
    await page.goto(`${FRONTEND}/charging?view=stations`, { waitUntil: 'domcontentloaded' });
    await page.locator('.page-title').first().waitFor({ timeout: 15000 });
    await sleep(1500);
    await page.screenshot({ path: path.join(SHOTS, '3-nearby-header.png') });
    const c = await page.evaluate(() => { const t = document.querySelector('.page-title'); if (!t) return null; const r = t.getBoundingClientRect(); return { mid: r.left + r.width / 2, vw: window.innerWidth }; });
    const centerDelta = c ? Math.round(Math.abs(c.mid - c.vw / 2)) : 999;
    results.push([`Nearby header centered (Δ${centerDelta}px from center)`, centerDelta < 24]);

    // (4) StationMap modal (portal, full-screen) + navigation status not underlapping
    log('[4] StationMap modal + navigation status');
    const cards = page.locator('.station-card');
    const nCards = await cards.count();
    if (nCards > 0) {
      // pick a routable station (skip a 0 km one so OSRM can compute a route)
      await cards.nth(nCards > 1 ? 1 : 0).click();
      await page.locator('.station-map-overlay').waitFor({ timeout: 12000 });
      await sleep(2000);
      await page.screenshot({ path: path.join(SHOTS, '4-stationmap.png') });
      const portalOk = await page.evaluate(() => {
        const o = document.querySelector('.station-map-overlay'); if (!o) return false;
        const r = o.getBoundingClientRect();
        return o.parentElement === document.body && r.top <= 1 && r.height >= window.innerHeight - 2;
      });
      results.push(['StationMap modal portaled to body & full-screen', portalOk]);

      // Drive into navigation and confirm the "Navigating to" bar does not overlap the actions.
      try {
        const startBtn = page.getByRole('button', { name: /Start Navigation/i });
        await startBtn.waitFor({ timeout: 8000 });
        await page.waitForFunction(() => {
          const b = [...document.querySelectorAll('button')].find((x) => /Start Navigation/i.test(x.textContent || ''));
          return b && !(b).disabled;
        }, null, { timeout: 18000 });
        await startBtn.click();
        await page.locator('.navigation-status').waitFor({ timeout: 12000 });
        await sleep(1500);
        await page.screenshot({ path: path.join(SHOTS, '4b-navigation-status.png') });
        const chk = await page.evaluate(() => {
          const s = document.querySelector('.navigation-status'); if (!s) return { ok: false };
          const sr = s.getBoundingClientRect();
          const within = sr.bottom <= window.innerHeight + 1 && sr.top >= 0;
          const a = document.querySelector('.nav-actions');
          let noOverlap = true;
          if (a) { const ar = a.getBoundingClientRect(); noOverlap = sr.top >= ar.bottom - 1; }
          return { ok: within && noOverlap, within, noOverlap };
        });
        results.push([`Navigation "Navigating to" bar not underlapping (in-viewport=${chk.within}, below-actions=${chk.noOverlap})`, !!chk.ok]);
      } catch (e) {
        results.push([`Navigation status check skipped (route not ready: ${(e.message || '').split('\n')[0]})`, false]);
      }
    } else {
      results.push(['StationMap modal (no station cards found — check backend GET /stations/nearby)', false]);
    }
    await ctx.close();

    // ---------- Owner screen (read-only) ----------
    log('[2] Owner station details (compact)');
    const octx = await authedContext(browser, token(OWNER_USER_ID, 'owner'), { usr_id: OWNER_USER_ID, name: 'Owner', usr_typ_cd: 'owner' });
    const opage = await octx.newPage();
    await opage.goto(`${FRONTEND}/owner/stations/${OWNER_STATION_ID}`, { waitUntil: 'domcontentloaded' });
    await sleep(3000);
    await opage.screenshot({ path: path.join(SHOTS, '2-owner-station-details.png') });
    const rowH = await opage.evaluate(() => { const row = document.querySelector('.owner-info-row'); return row ? Math.round(row.getBoundingClientRect().height) : null; });
    results.push([`Owner station-detail rows compact (row height ${rowH ?? '?'}px)`, rowH != null && rowH <= 56]);
    await octx.close();

    // ---------- Report ----------
    log('\n================ UI REVIEW ================');
    let pass = 0;
    results.forEach(([name, okk]) => { log(`${okk ? '✅' : '⚠️ '} ${name}`); if (okk) pass++; });
    log(`\n${pass}/${results.length} checks passed`);
    log('Screenshots: tests/ui/results/ (1-wallet-toast, 2-owner-station-details, 3-nearby-header, 4-stationmap)');
    await sleep(1500);
    await browser.close();
    return pass === results.length;
  } catch (e) {
    log('\n💥 ' + (e.stack || e.message || e));
    await sleep(1000);
    await browser.close();
    return false;
  }
}

(async () => {
  log('============ UI REVIEW (headed) ============');
  const ok = await run();
  process.exit(ok ? 0 : 1);
})();
