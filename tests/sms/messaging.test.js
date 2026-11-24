/**
 * Integration test for database-driven messaging (utils/messageService).
 *
 *   node tests/sms/messaging.test.js
 *
 * Runs against the real database but with the SMS gateway in MOCK mode
 * (MSG91_AUTH_KEY is blanked for this process), so NO SMS is sent and no
 * credits are used. It creates its own template / variable rows, proves that
 * messages.send() follows them with no code change or restart, then removes
 * every row it created. It needs the DJT_OTP template row to exist.
 */
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
process.env.MSG91_AUTH_KEY = ''; // force mock mode BEFORE anything loads .env
require('dotenv').config({ path: path.join(ROOT, '.env') });
global.appRoot = ROOT;

const { pool } = require(path.join(ROOT, 'config/db.config'));
const messages = require(path.join(ROOT, 'utils/messageService'));
const jwt = require('jsonwebtoken');

const M_USER = '9000000001';   // made-up numbers, used only as mock recipients
const M_OTP = '9000000003';
const TEST_MOBILES = [M_USER, M_OTP].map((m) => '91' + m);
const BAD_LOGGED = ['98abc43210', '98765', '911234567890', '98765432101'];
const OTP = 'DJT_OTP';
const TPL = 'ZZ_TEST_CHARGE_DONE';
const TPL2 = 'ZZ_TEST_OWNER_ALERT';

let passed = 0, failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; console.log('PASS  ' + name); }
  else { failed++; console.log('FAIL  ' + name + (detail !== undefined ? '  -> ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : '')); }
}
const q = async (sql, params) => (await pool.query(sql, params))[0];
const lastLog = async (mobile) => (await q('SELECT * FROM sms_msg_log_t WHERE mobile_tx = ? ORDER BY msg_id DESC LIMIT 1', ['91' + mobile]))[0];
const countLogs = async () => (await q('SELECT COUNT(*) n FROM sms_msg_log_t'))[0].n;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function cleanup() {
  await q('DELETE FROM sms_msg_log_t WHERE mobile_tx IN (?)', [TEST_MOBILES.concat(BAD_LOGGED)]);
  await q('DELETE FROM sms_tmplt_lst_t WHERE tmplt_cd IN (?)', [[TPL, TPL2]]); // cascades to variable rows
  await q('DELETE FROM otp_lst_t WHERE phn_nmbr_tx = ?', [M_OTP]);
}

(async () => {
  let server = null;
  let otpWasActive = null;
  try {
    await cleanup();
    const otpRow = (await q('SELECT tmplt_id, a_in FROM sms_tmplt_lst_t WHERE tmplt_cd = ?', [OTP]))[0];
    check('Setup: the DJT_OTP template row exists and is active', !!otpRow && otpRow.a_in === 1, otpRow);
    if (!otpRow) throw new Error('DJT_OTP template row is missing; insert it first');
    otpWasActive = otpRow.a_in;

    // ---------- 1. the OTP template ----------
    let r = await messages.send(OTP, M_OTP, { otp: '4821', expiry_minutes: 5 });
    check('OTP: send(code, mobile, data) succeeds', r.success === true, r);
    check('OTP: ran in mock mode (nothing really sent)', r.mock === true && r.status === 'MOCK', r);
    check('OTP: the returned text has the code in place of ##var1##', /4821/.test(r.text) && !/##/.test(r.text), r.text);
    let log = await lastLog(M_OTP);
    check('OTP: logged with template id, status MOCK and the final text',
      log && Number(log.tmplt_id) === Number(otpRow.tmplt_id) && log.stts_cd === 'MOCK' && log.rndrd_body_tx === r.text && /"var1":"4821"/.test(log.vars_tx), log);

    // ---------- 2. a code with no template row sends nothing ----------
    let before = await countLogs();
    r = await messages.send('ZZ_DOES_NOT_EXIST', M_USER, { a: 1 });
    check('Unknown template code -> SKIPPED, nothing thrown', !r.success && r.status === 'SKIPPED' && /No active template/.test(r.error), r);
    r = await messages.send(TPL, M_USER, { station_name: 'X' });
    check('Template not inserted yet -> SKIPPED', r.status === 'SKIPPED', r);
    check('Skipped sends write nothing to the log', (await countLogs()) === before);

    // ---------- 3. add a template purely with INSERTs ----------
    await q(`INSERT INTO sms_tmplt_lst_t (tmplt_cd, prvdr_tmplt_id_tx, tmplt_nm_tx, body_tx, sndr_id_tx)
             VALUES (?, 'zz-test-provider-id-1', 'Test charging done',
             'Hi ##var1##, charging at ##var2## is complete. Energy ##var3## kWh, amount Rs ##var4##, refund Rs ##var5##. ##var6## - DJT', 'DJT1')`, [TPL]);
    const t1 = (await q('SELECT tmplt_id FROM sms_tmplt_lst_t WHERE tmplt_cd = ?', [TPL]))[0].tmplt_id;
    await q(`INSERT INTO sms_tmplt_var_lst_t (tmplt_id, var_nm_tx, src_ky_tx, frmt_cd, dflt_vl_tx, mx_lngth_nbr) VALUES
             (?, 'var1', 'user.name',     'text',   'Customer', NULL),
             (?, 'var2', 'station_name',  'text',   NULL,       12),
             (?, 'var3', 'energy_kwh',    'number', NULL,       NULL),
             (?, 'var4', 'amount',        'amount', NULL,       NULL),
             (?, 'var5', 'refund_amount', 'amount', '0',        NULL),
             (?, 'var6', NULL,            'text',   'Thank you', NULL)`, [t1, t1, t1, t1, t1, t1]);

    const data = { user: { name: 'Ravi' }, station_name: 'DJT Rajahmundry Central Station', energy_kwh: 7.5, amount: 112.5, refund_amount: 37.5 };
    r = await messages.send(TPL, M_USER, data);
    check('New template: sent immediately, with no code change or restart', r.success, r);
    const body = r.text || '';
    check('Variables: name from user.name', body.includes('Hi Ravi,'), body);
    check('Variables: text cut to the max length (12)', body.includes('charging at DJT Rajahmun is'), body);
    check('Variables: number formatted without trailing zeros', body.includes('Energy 7.5 kWh'), body);
    check('Variables: amounts formatted to 2 decimals', body.includes('amount Rs 112.50') && body.includes('refund Rs 37.50'), body);
    check('Variables: fixed text from the default value', body.includes('Thank you - DJT'), body);
    log = await lastLog(M_USER);
    check('Log: variables, template and text recorded', log && Number(log.tmplt_id) === Number(t1) && /"var4":"112.50"/.test(log.vars_tx) && log.rndrd_body_tx === body, log && log.vars_tx);

    const send = (extra, mobile) => messages.send(TPL, mobile === undefined ? M_USER : mobile, Object.assign({ user: { name: 'Ravi' }, station_name: 'S', energy_kwh: 1, amount: 5 }, extra));

    r = await messages.send(TPL, M_USER, { station_name: 'S', energy_kwh: 2, amount: 30 });
    check('Variables: defaults fill in missing data', /Hi Customer,/.test(r.text) && /refund Rs 0\.00/.test(r.text), r.text);

    // ---------- 4. a required value is missing ----------
    r = await messages.send(TPL, M_USER, { energy_kwh: 2, amount: 30 });
    check('Missing variable: not sent, says which one and why', !r.success && r.status === 'FAILED' && /Missing template variables: var2/.test(r.error) && /"station_name" is empty/.test(r.error), r);
    log = await lastLog(M_USER);
    check('Missing variable: logged as FAILED', log.stts_cd === 'FAILED' && /var2/.test(log.err_tx || ''), { s: log.stts_cd, e: log.err_tx });

    // ---------- 5. recipient ----------
    const anyUser = (await q(`SELECT usr_id, nm_tx, phn_nmbr_tx FROM usr_lst_t WHERE a_in = 1 AND phn_nmbr_tx <> '' ORDER BY usr_id LIMIT 1`))[0];
    if (anyUser) {
      r = await messages.send(TPL, M_USER, { userId: anyUser.usr_id, station_name: 'S', energy_kwh: 1, amount: 5 });
      check('userId -> user.name filled from the users table', r.success && r.text.includes('Hi ' + (anyUser.nm_tx || 'Customer') + ','), r.text);
      const pvUser = await messages.preview(TPL, null, { userId: anyUser.usr_id, station_name: 'S', energy_kwh: 1, amount: 5 });
      check('No mobile given + userId -> goes to that user\'s own number (preview only)', pvUser.mobile === messages.normalizeMobile(anyUser.phn_nmbr_tx), pvUser.mobile);
    }
    if (anyUser) {
      const ledger = require(path.join(ROOT, 'api/modules/ledger/services/ledgerService'));
      const bal = await ledger.getWalletBalance(anyUser.usr_id);
      await q("UPDATE sms_tmplt_var_lst_t SET src_ky_tx = 'balance', dflt_vl_tx = NULL WHERE tmplt_id = ? AND var_nm_tx = 'var5'", [t1]);
      let pvBal = await messages.preview(TPL, M_USER, { userId: anyUser.usr_id, station_name: 'S', energy_kwh: 1, amount: 5 });
      check('balance -> the current wallet balance of the user, looked up automatically', pvBal.variables.var5 === Number(bal).toFixed(2), { got: pvBal.variables.var5, bal });
      pvBal = await messages.preview(TPL, M_USER, { userId: anyUser.usr_id, balance: 123.4, station_name: 'S', energy_kwh: 1, amount: 5 });
      check('balance passed by the caller is used as given', pvBal.variables.var5 === '123.40', pvBal.variables);
      await q("UPDATE sms_tmplt_var_lst_t SET src_ky_tx = 'refund_amount', dflt_vl_tx = '0' WHERE tmplt_id = ? AND var_nm_tx = 'var5'", [t1]);
    }
    before = await countLogs();
    for (const [label, bad] of [['null, and no userId', null], ['empty text', '   '], ['an object', { n: 1 }]]) {
      r = await send({}, bad);
      check(`Mobile is ${label} -> FAILED with the reason`, !r.success && r.status === 'FAILED' && /mobile number/i.test(r.error), r);
    }
    for (const badId of [-5, 0, 'abc', 99999999, 1.5]) {
      r = await messages.send(TPL, null, { userId: badId, station_name: 'S', energy_kwh: 1, amount: 5 });
      check(`userId ${JSON.stringify(badId)} and no mobile -> no crash, FAILED (no recipient)`, !r.success && /No mobile number/.test(r.error), r);
    }
    check('Sends with no usable recipient write nothing to the log', (await countLogs()) === before);
    for (const [label, bad] of [['letters', '98abc43210'], ['too short', '98765'], ['starts with 1', '1234567890'], ['11 digits', '98765432101']]) {
      r = await send({}, bad);
      check(`Bad mobile (${label}) -> FAILED "Invalid mobile number"`, !r.success && /Invalid mobile number/.test(r.error), r);
    }
    for (const good of ['+91 90000 00001', '090000-00001', '919000000001', 9000000001]) {
      r = await send({}, good);
      log = await lastLog(M_USER);
      check(`Mobile written as ${JSON.stringify(good)} -> normalized and sent`, r.success && Number(log.msg_id) === Number(r.msgId), r);
    }

    // ---------- 6. bad variable values ----------
    r = await send({ amount: 'abc' });
    check('Amount is not a number -> not sent, says which variable and why', !r.success && /var4/.test(r.error) && /not a valid amount/.test(r.error), r);
    r = await send({ energy_kwh: { kwh: 7 } });
    check('Value is an object -> not sent (never "[object Object]")', !r.success && /var3/.test(r.error) && /not a simple value/.test(r.error), r);
    r = await send({ energy_kwh: NaN });
    check('Value is NaN -> not sent', !r.success && /var3/.test(r.error), r);
    r = await send({ amount: 0, energy_kwh: 0 });
    check('Zero is a real value, not "missing"', r.success && /Energy 0 kWh, amount Rs 0\.00/.test(r.text), r);
    r = await send({ amount: '1,250.5' });
    check('Amount given as text "1,250.5" -> 1250.50', r.success && /amount Rs 1250\.50/.test(r.text), r);
    r = await send({ user: { name: '  Ravi\n Kumar\t ' } });
    check('Line breaks and extra spaces in a value are cleaned', /Hi Ravi Kumar,/.test(r.text), r.text);
    r = await send({ user: { name: 'A'.repeat(80) } });
    check('Long value cut to the DLT limit of 30 characters', new RegExp('Hi A{30},').test(r.text), (r.text || '').slice(0, 60));
    r = await send({ user: { name: '' } });
    check('Empty text falls back to the default', /Hi Customer,/.test(r.text), r.text);
    for (const badData of [null, 'text', 7, [1, 2]]) {
      r = await messages.send(OTP, M_OTP, badData);
      check(`Data ${JSON.stringify(badData)} -> no crash, FAILED for the missing variable`, !r.success && /Missing template variables: var1/.test(r.error), r);
    }
    for (const badCode of [null, undefined, '', 42, {}]) {
      r = await messages.send(badCode, M_USER, {});
      check(`Template code ${JSON.stringify(badCode)} -> rejected cleanly`, !r.success && /Template code is required/.test(r.error), r);
    }

    // ---------- 7. bad rows, and checkSetup ----------
    await q(`UPDATE sms_tmplt_var_lst_t SET frmt_cd = 'currency' WHERE tmplt_id = ? AND var_nm_tx = 'var4'`, [t1]);
    await q(`INSERT INTO sms_tmplt_var_lst_t (tmplt_id, var_nm_tx, src_ky_tx) VALUES (?, 'var9', 'no_such_key')`, [t1]);
    r = await send({ amount: 12.5 });
    check('Unknown format in a row -> still sent, value shown as text', r.success && /amount Rs 12\.5,/.test(r.text), r);
    let chk = await messages.checkSetup();
    check('checkSetup: reports the unknown format', chk.errors.some((e) => e.includes(TPL) && e.includes('unknown format "currency"')), chk.errors);
    check('checkSetup: reports a variable the body never uses', chk.warnings.some((w) => w.includes(TPL) && w.includes('"var9"')), chk.warnings);
    check('checkSetup: says a new template still needs a messages.send() call', chk.warnings.some((w) => w.includes(TPL) && w.includes("messages.send('" + TPL + "'")), chk.warnings);
    await q(`UPDATE sms_tmplt_var_lst_t SET frmt_cd = 'amount' WHERE tmplt_id = ? AND var_nm_tx = 'var4'`, [t1]);
    await q(`DELETE FROM sms_tmplt_var_lst_t WHERE tmplt_id = ? AND var_nm_tx = 'var9'`, [t1]);

    await q(`UPDATE sms_tmplt_var_lst_t SET var_nm_tx = 'Var2' WHERE tmplt_id = ? AND var_nm_tx = 'var2'`, [t1]);
    r = await send({});
    check('Variable name with the wrong case -> not sent, missing var2 reported', !r.success && /Missing template variables: var2/.test(r.error), r);
    chk = await messages.checkSetup();
    check('checkSetup: explains the case mismatch', chk.errors.some((e) => e.includes('##var2## has no variable row') && e.includes('case-sensitive')), chk.errors);
    await q(`UPDATE sms_tmplt_var_lst_t SET var_nm_tx = 'var2' WHERE tmplt_id = ? AND var_nm_tx = 'Var2'`, [t1]);

    await q(`INSERT INTO sms_tmplt_lst_t (tmplt_cd, prvdr_tmplt_id_tx, tmplt_nm_tx, body_tx, sndr_id_tx)
             VALUES (?, 'zz-test-provider-id-2', 'Test owner alert', 'Charging done at {#var#}. - DJT', 'DJT1')`, [TPL2]);
    chk = await messages.checkSetup();
    check('checkSetup: reports a body written in DLT {#var#} style', chk.errors.some((e) => e.includes(TPL2) && e.includes('{#var#}')), chk.errors);
    check('checkSetup: flags a provider id that is not a MSG91 id', chk.warnings.some((w) => w.includes(TPL) && w.includes('does not look like a MSG91 template id')), chk.warnings);
    check('checkSetup: no complaint about the real DJT_OTP template', !chk.errors.some((e) => e.includes(OTP)), chk.errors);

    await q(`UPDATE sms_tmplt_var_lst_t SET src_ky_tx = 'no_such_key' WHERE tmplt_id = ? AND var_nm_tx = 'var1'`, [otpRow.tmplt_id]);
    chk = await messages.checkSetup();
    check('checkSetup: reports a variable that reads a value the application does not pass', chk.errors.some((e) => e.includes(OTP) && e.includes('no_such_key')), chk.errors);
    await q(`UPDATE sms_tmplt_var_lst_t SET src_ky_tx = 'otp' WHERE tmplt_id = ? AND var_nm_tx = 'var1'`, [otpRow.tmplt_id]);

    await q(`UPDATE sms_tmplt_lst_t SET a_in = 0 WHERE tmplt_id = ?`, [t1]);
    r = await send({});
    check('a_in = 0 on the template switches the message off (SKIPPED)', r.status === 'SKIPPED', r);
    await q(`UPDATE sms_tmplt_lst_t SET a_in = 1 WHERE tmplt_id = ?`, [t1]);

    // ---------- 8. preview: real values in the template, nothing sent ----------
    before = await countLogs();
    let pv = await messages.preview(TPL, M_USER, { user: { name: 'Ravi' }, station_name: 'DJT Kakinada', energy_kwh: 7.5, amount: 112.5, refund_amount: 37.5 });
    check('Preview: final text has the real values in place of the placeholders',
      pv.text === 'Hi Ravi, charging at DJT Kakinada is complete. Energy 7.5 kWh, amount Rs 112.50, refund Rs 37.50. Thank you - DJT' && pv.would_send === true, pv);
    check('Preview: shows the recipient and each variable value', pv.mobile === '91' + M_USER && pv.variables.var4 === '112.50' && pv.length === pv.text.length, pv);
    pv = await messages.preview(TPL, M_USER, { energy_kwh: 1, amount: 5 });
    check('Preview: unfilled placeholder is left visible and explained', pv.text.includes('##var2##') && pv.would_send === false && pv.problems.some((x) => x.startsWith('var2:')), pv);
    pv = await messages.preview(OTP, M_OTP, { otp: '246810' });
    check('Preview: works for the OTP template', /246810/.test(pv.text) && pv.would_send, pv);
    pv = await messages.preview('ZZ_NOPE', M_USER, {});
    check('Preview: unknown code -> clear error', !!pv.error && pv.would_send === false, pv);
    check('Preview writes nothing to the message log', (await countLogs()) === before);

    // ---------- 9. through the real HTTP API ----------
    server = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: '5057', MSG91_AUTH_KEY: '' }, stdio: 'ignore' });
    const base = 'http://localhost:5057/api';
    for (let i = 0; i < 60; i++) { try { if ((await fetch(base + '/health', { signal: AbortSignal.timeout(1500) })).ok) break; } catch { /* starting */ } await sleep(500); }
    const post = async (url, reqBody, headers) => {
      const res = await fetch(base + url, { method: 'POST', headers: Object.assign({ 'content-type': 'application/json' }, headers || {}), body: JSON.stringify(reqBody) });
      return { http: res.status, json: await res.json().catch(() => ({})) };
    };
    let h = await post('/auth/app/signup/otp', { phonenumber: M_OTP });
    check('API: signup OTP request succeeds', h.http === 200 && h.json.data && h.json.data.status === 'sent', h);
    const devOtp = h.json.data && h.json.data.dev_otp;
    log = await lastLog(M_OTP);
    check('API: the OTP in the logged SMS is the one that was issued', !!devOtp && log.rndrd_body_tx.includes(devOtp), { devOtp, body: log.rndrd_body_tx });
    h = await post('/auth/app/verify/otp', { phno: M_OTP, otp: devOtp });
    check('API: that OTP verifies', h.http === 200 && h.json.data && h.json.data.verified === true, h);

    await q(`UPDATE sms_tmplt_lst_t SET a_in = 0 WHERE tmplt_cd = ?`, [OTP]);
    h = await post('/auth/app/signup/otp', { phonenumber: M_OTP });
    check('API: OTP template switched off in DB -> clear failure in the body, not a false "sent"', h.http === 200 && h.json.status === 502 && /could not send the OTP/.test(h.json.message), h);
    const taken = (await q("SELECT phn_nmbr_tx FROM usr_lst_t WHERE a_in = 1 AND CHAR_LENGTH(phn_nmbr_tx) = 10 ORDER BY usr_id LIMIT 1"))[0];
    if (taken) {
      h = await post('/auth/app/signup/otp', { phonenumber: taken.phn_nmbr_tx });
      check('API: signup with a registered number -> HTTP 200 carrying status 409 and the reason', h.http === 200 && h.json.status === 409 && /already registered/.test(h.json.message), h);
      h = await post('/auth/register', { phone: taken.phn_nmbr_tx, name: 'X' });
      check('API: register with a registered number -> HTTP 200 carrying status 409 and the reason', h.http === 200 && h.json.status === 409 && /already exists/.test(h.json.message), h);
    }
    chk = await messages.checkSetup();
    check('checkSetup: warns loudly when the OTP template is not active', chk.errors.some((e) => e.includes(OTP) && e.includes('cannot receive their OTP')), chk.errors);
    await q(`UPDATE sms_tmplt_lst_t SET a_in = 1 WHERE tmplt_cd = ?`, [OTP]);

    const admin = jwt.sign({ userId: 0, userType: 'admin' }, process.env.JWT_SECRET, { expiresIn: '5m' });
    const customer = jwt.sign({ userId: 0, userType: 'customer' }, process.env.JWT_SECRET, { expiresIn: '5m' });
    const reqBody = { template: TPL, mobile: M_USER, data };
    h = await post('/sms/send', reqBody, {});
    check('API: /sms/send refuses requests with no token', h.http === 401, h.http);
    h = await post('/sms/send', reqBody, { 'x-access-token': customer });
    check('API: /sms/send refuses non-admin users', h.http === 403, h.http);
    h = await post('/sms/send', reqBody, { 'x-access-token': admin });
    check('API: admin can send a template by hand', h.http === 200 && h.json.data && h.json.data.success === true && h.json.data.text.includes('Hi Ravi,'), h);
    h = await post('/sms/preview', reqBody, { 'x-access-token': admin });
    check('API: /sms/preview returns the final text', h.http === 200 && h.json.data && h.json.data.text.includes('amount Rs 112.50'), h);
    h = await post('/sms/send', { template: 'ZZ_NOPE', mobile: M_USER }, { 'x-access-token': admin });
    check('API: /sms/send with an unknown template code -> 400 with the reason', h.http === 400 && /No active template/.test(h.json.message), h);
  } catch (e) {
    failed++;
    console.log('ERROR ' + ((e && (e.stack || e.err_message)) || e));
  } finally {
    if (server) server.kill();
    try {
      if (otpWasActive !== null) {
        await q('UPDATE sms_tmplt_lst_t SET a_in = ? WHERE tmplt_cd = ?', [otpWasActive, OTP]);
        await q(`UPDATE sms_tmplt_var_lst_t v JOIN sms_tmplt_lst_t t ON t.tmplt_id = v.tmplt_id
                    SET v.src_ky_tx = 'otp' WHERE t.tmplt_cd = ? AND v.var_nm_tx = 'var1' AND v.src_ky_tx = 'no_such_key'`, [OTP]);
      }
      await cleanup();
    } catch (e) { console.log('cleanup error: ' + ((e && e.message) || e)); }
    const left = await q('SELECT (SELECT COUNT(*) FROM sms_tmplt_lst_t WHERE tmplt_cd LIKE \'ZZ_TEST%\') t, (SELECT COUNT(*) FROM sms_msg_log_t) l').catch(() => [{}]);
    console.log(`\n${passed} passed, ${failed} failed. Test rows left behind: templates=${left[0].t}, log rows=${left[0].l}`);
    await pool.end().catch(() => {});
    process.exit(failed ? 1 : 0);
  }
})();
