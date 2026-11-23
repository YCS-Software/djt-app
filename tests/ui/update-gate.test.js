/**
 * End-to-end test of the server-controlled app update check.
 *
 *   node tests/ui/update-gate.test.js
 *
 * Starts the real backend (port 5000) with different APP_MIN_VERSION_CODE values and
 * the real app (Vite dev server, port 3000), then drives a mobile-sized Chromium
 * with Playwright. No login is performed and no SMS is sent. Screenshots are
 * written to tests/ui/results/update-gate/.
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const APP_DIR = path.join(ROOT, 'mobile_app');
const OUT = path.join(__dirname, 'results', 'update-gate');
const API = 'http://localhost:5000/api';
const WEB = 'http://localhost:3000';
const STORE_URL = 'https://play.google.com/store/apps/details?id=com.djthaika.ev';
fs.mkdirSync(OUT, { recursive: true });

const gradle = fs.readFileSync(path.join(APP_DIR, 'android/app/build.gradle'), 'utf8');
const CODE = parseInt(gradle.match(/versionCode\s+(\d+)/)[1], 10);
const NAME = gradle.match(/versionName\s+"([^"]+)"/)[1];

let passed = 0, failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; console.log('PASS  ' + name); }
  else { failed++; console.log('FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(url, ms = 60000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { const r = await fetch(url, { signal: AbortSignal.timeout(2000) }); if (r.status < 500) return true; } catch { /* not up yet */ }
    await sleep(500);
  }
  throw new Error('timed out waiting for ' + url);
}

let backend = null;
async function stopBackend() {
  if (!backend) return;
  const p = backend; backend = null;
  await new Promise((r) => { p.once('exit', r); p.kill(); setTimeout(r, 4000); });
  await sleep(400);
}
async function startBackend(extraEnv) {
  await stopBackend();
  const env = { ...process.env, PORT: '5000' };
  for (const k of Object.keys(env)) if (k.startsWith('APP_')) delete env[k];
  Object.assign(env, extraEnv || {});
  backend = spawn(process.execPath, ['server.js'], { cwd: ROOT, env, stdio: 'ignore' });
  await waitFor(API + '/health');
}

(async () => {
  console.log(`App under test: version ${NAME} (build ${CODE})\n`);
  const vite = spawn(process.execPath, [path.join(APP_DIR, 'node_modules/vite/bin/vite.js'), '--port', '3000', '--strictPort'],
    { cwd: APP_DIR, stdio: 'ignore' });
  const browser = await chromium.launch();
  const contexts = [];

  async function newPage(init) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await ctx.addInitScript(() => {
      window.__opened = [];
      window.open = (u, t) => { window.__opened.push({ url: u, target: t }); return {}; };
    });
    if (init) await init(ctx);
    contexts.push(ctx);
    return ctx.newPage();
  }
  const visible = (page, id) => page.getByTestId(id).isVisible();
  const shot = (page, name) => page.screenshot({ path: path.join(OUT, name + '.png') });
  const openedLinks = (page) => page.evaluate(() => window.__opened);
  async function open(page) {
    await page.goto(WEB + '/login', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
  }

  try {
    await waitFor(WEB);

    // ---- 1. API contract (one setting: APP_MIN_VERSION_CODE) -------------
    await startBackend({ APP_MIN_VERSION_CODE: String(CODE + 1) });
    let r = await (await fetch(`${API}/app/version?platform=android&version_code=${CODE}`)).json();
    check('API: is public (no token) and returns 200', r.status === 200);
    check('API: build below minimum -> update_required', r.data.update_required === true && r.data.min_version_code === CODE + 1);
    check('API: returns the Play Store link', (r.data.update_url === STORE_URL));
    r = await (await fetch(`${API}/app/version?platform=android&version_code=${CODE + 1}`)).json();
    check('API: build equal to minimum -> allowed', r.data.update_required === false);
    r = await (await fetch(`${API}/app/version?platform=android&version_code=${CODE + 5}`)).json();
    check('API: newer build -> allowed', r.data.update_required === false);
    r = await (await fetch(`${API}/app/version?platform=android&version_code=abc`)).json();
    check('API: junk version_code never forces an update', r.status === 200 && r.data.update_required === false);
    r = await (await fetch(`${API}/app/version?platform=ios&version_code=1`)).json();
    check('API: setting is Android-only (iOS build 1 not blocked)', r.data.platform === 'ios' && r.data.update_required === false);
    await startBackend({ APP_MIN_VERSION_CODE: 'not-a-number' });
    r = await (await fetch(`${API}/app/version?platform=android&version_code=1`)).json();
    check('API: invalid setting -> nobody is blocked', r.data.update_required === false && r.data.min_version_code === 0);

    // ---- 2. Setting absent: app behaves exactly as before ----------------
    await startBackend({});
    let page = await newPage();
    await open(page);
    check('UI: setting absent -> no update screen', !(await visible(page, 'update-required')) && !(await visible(page, 'server-unreachable')));
    check('UI: login page is usable', await page.locator('input').first().isVisible());
    await shot(page, '1-no-update-login');

    // ---- 3. Mandatory update --------------------------------------------
    await startBackend({ APP_MIN_VERSION_CODE: String(CODE + 1) });
    page = await newPage();
    await open(page);
    check('UI: mandatory -> "Update required" screen shown', await visible(page, 'update-required'));
    const reqText = await page.getByTestId('update-required').innerText().catch(() => '');
    check('UI: mandatory -> shows installed version', reqText.includes(`${NAME} (${CODE})`), reqText.split(String.fromCharCode(10)).join(' | '));
    check('UI: mandatory -> only one button, no way to dismiss', (await page.getByTestId('update-required').getByRole('button').count()) === 1);
    const box = await page.getByTestId('update-required').boundingBox();
    check('UI: mandatory -> covers the whole screen', !!box && box.width >= 390 && box.height >= 844);
    await page.keyboard.press('Escape');
    check('UI: mandatory -> Escape does not close it', await visible(page, 'update-required'));
    await shot(page, '2-update-required');
    await page.getByRole('button', { name: 'Update now' }).click();
    let o = await openedLinks(page);
    check('UI: "Update now" opens the Play Store link outside the app', o.length === 1 && (o[0].url === STORE_URL) && o[0].target === '_system', JSON.stringify(o));
    await page.goto(WEB + '/home', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    check('UI: mandatory -> also blocks other pages', await visible(page, 'update-required'));

    // ---- 4. Setting equal to this build: not blocked ---------------------
    await startBackend({ APP_MIN_VERSION_CODE: String(CODE) });
    page = await newPage();
    await open(page);
    check('UI: build equals the minimum -> nothing shown', !(await visible(page, 'update-required')) && await page.locator('input').first().isVisible());

    // ---- 5. Raising the setting later blocks an already-open app ---------
    await startBackend({ APP_MIN_VERSION_CODE: String(CODE + 1) });
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('djt:online')));
    await page.getByTestId('update-required').waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    check('UI: raising the setting blocks the app on its next check', await visible(page, 'update-required'));

    // ---- 6. Older server without the endpoint (404) ---------------------
    page = await newPage(async (ctx) => ctx.route('**/api/app/version**', (rt) => rt.fulfill({ status: 404, contentType: 'application/json', body: '{"status":404,"message":"Invalid route"}' })));
    await open(page);
    check('UI: server without this endpoint (404) -> app not blocked', !(await visible(page, 'update-required')) && !(await visible(page, 'server-unreachable')));

    // ---- 7. Phone offline -> leave it to the offline banner -------------
    page = await newPage(async (ctx) => {
      await ctx.addInitScript(() => Object.defineProperty(navigator, 'onLine', { get: () => false }));
      await ctx.route('**/api/**', (rt) => rt.abort('internetdisconnected'));
    });
    await open(page);
    check('UI: phone offline -> no server-unreachable screen', !(await visible(page, 'server-unreachable')));

    // ---- 8. Server down while the phone is online -----------------------
    await stopBackend();
    page = await newPage();
    await open(page);
    await page.getByTestId('server-unreachable').waitFor({ state: 'visible', timeout: 25000 }).catch(() => {});
    check('UI: server down -> server-unreachable screen shown', await visible(page, 'server-unreachable'));
    await shot(page, '3-server-unreachable');
    await page.getByRole('button', { name: 'Check for an update' }).click();
    o = await openedLinks(page);
    check('UI: server down -> "Check for an update" opens the store', o.length === 1 && /play\.google\.com/.test(o[0].url));
    await startBackend({});
    await page.getByRole('button', { name: 'Try again' }).click();
    await page.getByTestId('server-unreachable').waitFor({ state: 'hidden', timeout: 20000 }).catch(() => {});
    check('UI: server back -> "Try again" clears the screen', !(await visible(page, 'server-unreachable')));
    await shot(page, '4-recovered');
  } catch (e) {
    failed++;
    console.log('ERROR ' + ((e && e.stack) || e));
  } finally {
    for (const c of contexts) await c.close().catch(() => {});
    await browser.close().catch(() => {});
    await stopBackend();
    vite.kill();
    console.log(`\n${passed} passed, ${failed} failed. Screenshots: ${OUT}`);
    process.exit(failed ? 1 : 0);
  }
})();
