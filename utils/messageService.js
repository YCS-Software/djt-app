/**
 * Message Service — the ONE place the application sends SMS from.
 *
 *     const messages = require(appRoot + '/utils/messageService');
 *
 *     messages.send('DJT_OTP', '9876543210', { otp: '4821' });
 *                    │          │             └ the values the template may use
 *                    │          └ who receives it (null = the user in data.userId)
 *                    └ tmplt_cd of a row in sms_tmplt_lst_t
 *
 * Everything else comes from the database:
 *     sms_tmplt_lst_t       the approved MSG91 template (code, MSG91 id, text, sender)
 *     sms_tmplt_var_lst_t   one row per ##varN## in the text: which value fills it
 *     sms_msg_log_t         one row per message attempted (written automatically)
 *
 * To add a new message: insert the template row and its variable rows, then call
 * messages.send('<its tmplt_cd>', mobile, data) from the feature that needs it.
 *
 *   send(code, mobile, data)      send one template to one number
 *   preview(code, mobile, data)   the final text with real values; sends nothing
 *   checkSetup()                  find mistakes in the template / variable rows
 *
 * send() never throws. It resolves to { success, status, error, ... } where
 * status is SENT, MOCK (no MSG91 key: nothing really sent), FAILED, or SKIPPED
 * (no active template with that code — nothing is sent and nothing is logged).
 */

const msg91 = require(appRoot + '/config/msg91.config');
const smsMdl = require(appRoot + '/api/modules/sms/models/smsMdl');

const TIME_ZONE = 'Asia/Kolkata';
const COUNTRY_CODE = '91';
// DLT allows at most 30 characters in one template variable. Longer values make
// the operator reject the SMS, so values are cut to this unless the variable row
// sets its own mx_lngth_nbr.
const DLT_VARIABLE_MAX = 30;
const FORMATS = ['text', 'amount', 'number', 'date', 'time', 'datetime', 'mask_mobile'];
// Values every message can use, on top of what the caller passes in `data`.
const COMMON_KEYS = ['app_name', 'date', 'time', 'datetime', 'mobile', 'balance', 'user.id', 'user.name', 'user.mobile', 'owner.id', 'owner.name', 'owner.mobile'];

/**
 * Template codes the application sends, and the values each call passes: the
 * OTP, and one message each time wallet money is added or deducted.
 * A code with no active row in sms_tmplt_lst_t is simply not sent (except the
 * OTP, which login depends on). These names are what sms_tmplt_var_lst_t.src_ky_tx
 * can refer to. A new feature does not need an entry here to send a message;
 * adding one only lets checkSetup() verify its variable rows.
 */
const TEMPLATES = {
    DJT_OTP: { description: 'Login / signup OTP', required: true, keys: ['otp', 'expiry_minutes'] },
    WALLET_CREDITED: {
        description: 'Money was added to the wallet (top-up, or refund of the unused charging amount)',
        keys: ['amount', 'reason', 'reference', 'station_name', 'payment_method'],
    },
    WALLET_DEBITED: {
        description: 'Money was deducted from the wallet (charging payment, transfer)',
        keys: ['amount', 'reason', 'reference', 'station_name'],
    },
};

/* ------------------------------- helpers -------------------------------- */

const errText = (e) => (e && (e.err_message || e.message)) || String(e);

/** Read "a.b.c" from an object; undefined when any step is missing. */
function readPath(obj, path) {
    if (!path) return undefined;
    return String(path).split('.').reduce(
        (o, k) => (o !== null && o !== undefined ? o[k] : undefined), obj);
}

function isEmpty(v) {
    return v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
}

/** Only plain values can go into an SMS; objects / arrays / functions cannot. */
function isScalar(v) {
    return typeof v === 'string' || typeof v === 'boolean' || v instanceof Date
        || (typeof v === 'number' && Number.isFinite(v)) || typeof v === 'bigint';
}

function parts(date, opts) {
    const out = {};
    new Intl.DateTimeFormat('en-GB', Object.assign({ timeZone: TIME_ZONE }, opts))
        .formatToParts(date).forEach((p) => { out[p.type] = p.value; });
    return out;
}
function fmtDate(d) {
    const p = parts(d, { day: '2-digit', month: '2-digit', year: 'numeric' });
    return `${p.day}-${p.month}-${p.year}`;
}
function fmtTime(d) {
    const p = parts(d, { hour: '2-digit', minute: '2-digit', hour12: true });
    return `${p.hour}:${p.minute} ${String(p.dayPeriod || '').toUpperCase()}`.trim();
}
function toDate(v) {
    if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
    if (typeof v !== 'string' && typeof v !== 'number') return null;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
}

/**
 * Apply sms_tmplt_var_lst_t.frmt_cd to a raw value.
 * Returns the text, or null when the value cannot be shown in that format
 * (e.g. "abc" as an amount) — the caller then treats it as missing.
 */
function formatValue(value, format) {
    const f = String(format || 'text').toLowerCase();
    switch (f) {
        case 'amount': {
            const n = typeof value === 'string' ? Number(value.replace(/,/g, '')) : Number(value);
            return Number.isFinite(n) ? n.toFixed(2) : null;
        }
        case 'number': {
            const n = typeof value === 'string' ? Number(value.replace(/,/g, '')) : Number(value);
            // up to 3 decimals, no trailing zeros: 7.500 -> 7.5, 12.000 -> 12
            return Number.isFinite(n) ? String(Math.round(n * 1000) / 1000) : null;
        }
        case 'date': { const d = toDate(value); return d ? fmtDate(d) : null; }
        case 'time': { const d = toDate(value); return d ? fmtTime(d) : null; }
        case 'datetime': { const d = toDate(value); return d ? `${fmtDate(d)} ${fmtTime(d)}` : null; }
        case 'mask_mobile': {
            const s = String(value).replace(/\D/g, '');
            if (!s) return null;
            return s.length > 4 ? '******' + s.slice(-4) : s;
        }
        default: // 'text' and any unrecognised format
            return value instanceof Date ? `${fmtDate(value)} ${fmtTime(value)}` : String(value);
    }
}

/** One line, single spaces, no control characters — safe to place in an SMS. */
function cleanText(text) {
    return String(text).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

/** Placeholders written in a template body: ##var1## -> ['var1']. */
function placeholdersIn(body) {
    const out = [];
    const re = /##(\w+)##/g;
    let m;
    while ((m = re.exec(String(body || ''))) !== null) if (!out.includes(m[1])) out.push(m[1]);
    return out;
}

/**
 * Put the values into the template text: every ##name## that has a value is
 * replaced by it. `missing` lists the placeholders that had no value.
 */
function renderTemplate(body, variables) {
    const vars = variables || {};
    const text = String(body || '').replace(/##(\w+)##/g, (match, key) =>
        (Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : match));
    return { body: text, missing: placeholdersIn(text) };
}

/** "+91 98765-43210" / "09876543210" / 9876543210 -> "919876543210". */
function normalizeMobile(mobile) {
    let m = String(mobile === undefined || mobile === null ? '' : mobile).replace(/[\s\-()]/g, '');
    m = m.replace(/^\+/, '').replace(/^0+/, '');
    if (m.length === 10) m = COUNTRY_CODE + m;
    return m;
}

/**
 * Check that a value is an Indian mobile number (10 digits starting 6-9, with
 * or without +91 / 0 in front) and return it in MSG91's form.
 * @returns {{valid: boolean, mobile: string, error?: string}}
 */
function validateMobile(mobile) {
    const raw = String(mobile === undefined || mobile === null ? '' : mobile).trim();
    if (!raw) return { valid: false, mobile: '', error: 'Mobile number is empty' };
    if (/[^\d\s\-()+]/.test(raw)) {
        return { valid: false, mobile: raw.slice(0, 20), error: 'Mobile number contains invalid characters' };
    }
    const m = normalizeMobile(raw);
    if (!/^91\d{10}$/.test(m)) return { valid: false, mobile: m.slice(0, 20), error: 'Mobile number must have 10 digits' };
    if (!/^91[6-9]/.test(m)) return { valid: false, mobile: m, error: 'Mobile number must start with 6, 7, 8 or 9' };
    return { valid: true, mobile: m };
}

/**
 * The full set of values a template can use: what the caller passed, plus the
 * common keys, plus user / owner contact details looked up from their ids.
 */
async function buildContext(data) {
    const now = new Date();
    const facts = (data && typeof data === 'object' && !Array.isArray(data)) ? data : {};
    const ctx = Object.assign({
        app_name: 'DJT HAIKA',
        date: fmtDate(now),
        time: fmtTime(now),
        datetime: `${fmtDate(now)} ${fmtTime(now)}`,
    }, facts);

    const attach = async (idKey, objKey) => {
        if ((ctx[objKey] && typeof ctx[objKey] === 'object') || isEmpty(ctx[idKey])) return;
        const id = Number(ctx[idKey]);
        if (!Number.isInteger(id) || id <= 0) {
            console.warn(`[messages] ignoring invalid ${idKey}: ${JSON.stringify(ctx[idKey])}`);
            return;
        }
        try {
            const rows = await smsMdl.getUserContactMdl(id);
            if (rows && rows[0]) {
                ctx[objKey] = { id: rows[0].usr_id, name: rows[0].nm_tx || '', mobile: rows[0].phn_nmbr_tx || '' };
            } else {
                console.warn(`[messages] ${idKey} ${id} not found in usr_lst_t`);
            }
        } catch (e) {
            console.error(`[messages] could not load ${objKey} ${id}:`, errText(e));
        }
    };
    await attach('userId', 'user');
    await attach('ownerUserId', 'owner');
    return ctx;
}

/**
 * Turn a template's variable rows + the values into { var1: '...', ... }.
 * `problems` explains every variable that could not be filled, in plain words.
 */
function buildVariables(template, ctx, defs) {
    const variables = {};
    const problems = [];
    const defined = [];

    defs.forEach((d) => {
        const name = String(d.var_nm_tx || '').trim();
        if (!name) return;
        defined.push(name);

        const format = String(d.frmt_cd || 'text').toLowerCase();
        if (!FORMATS.includes(format)) {
            problems.push(`${name}: unknown format "${d.frmt_cd}" (treated as text)`);
        }

        // 1) the value named by src_ky_tx, 2) else the default from the row
        const candidates = [];
        if (d.src_ky_tx) candidates.push({ from: `"${d.src_ky_tx}"`, value: readPath(ctx, d.src_ky_tx) });
        candidates.push({ from: 'the default value', value: d.dflt_vl_tx });

        let text = null;
        const reasons = [];
        for (const c of candidates) {
            if (isEmpty(c.value)) { if (c.from !== 'the default value') reasons.push(`${c.from} is empty`); continue; }
            if (!isScalar(c.value)) { reasons.push(`${c.from} is not a simple value`); continue; }
            const formatted = formatValue(c.value, format);
            if (formatted === null || cleanText(formatted) === '') {
                reasons.push(`${c.from} (${JSON.stringify(c.value)}) is not a valid ${format}`);
                continue;
            }
            text = cleanText(formatted);
            break;
        }
        if (text === null) {
            problems.push(`${name}: no value — ${reasons.length ? reasons.join('; ') : 'no source key and no default'}`);
            return;
        }

        const own = parseInt(d.mx_lngth_nbr, 10);
        const max = Number.isFinite(own) && own > 0 ? own : DLT_VARIABLE_MAX;
        if (text.length > max) text = text.slice(0, max).trim();
        variables[name] = text;
    });

    // placeholders in the body that have no variable row at all
    placeholdersIn(template.body_tx).forEach((p) => {
        if (!defined.includes(p)) problems.push(`${p}: used in the template text but has no row in sms_tmplt_var_lst_t`);
    });

    return { variables, problems };
}

/**
 * Everything needed to send (or preview) one message, without sending it.
 * Returns { skipped | error } when it cannot be prepared, else the full plan.
 */
async function prepare(templateCode, mobile, data) {
    if (isEmpty(templateCode) || typeof templateCode !== 'string') return { error: 'Template code is required' };
    const code = templateCode.trim();
    const rows = await smsMdl.getTemplateByCodeMdl(code);
    const tmpl = rows && rows[0];
    if (!tmpl) return { skipped: true, error: `No active template with code "${code}" in sms_tmplt_lst_t` };

    const defs = (await smsMdl.getTemplateVarsMdl(tmpl.tmplt_id)) || [];
    const ctx = await buildContext(data);
    // "balance" = the user's wallet balance right now. Looked up only when the
    // template actually shows it and the caller did not pass it.
    if (isEmpty(ctx.balance) && defs.some((d) => String(d.src_ky_tx || '').trim() === 'balance')) {
        const uid = Number((ctx.user && ctx.user.id) || ctx.userId);
        if (Number.isInteger(uid) && uid > 0) {
            try {
                ctx.balance = await require(appRoot + '/api/modules/ledger/services/ledgerService').getWalletBalance(uid);
            } catch (e) {
                console.error(`[messages] could not load wallet balance of user ${uid}:`, errText(e));
            }
        }
    }
    const to = isEmpty(mobile) ? (ctx.user && ctx.user.mobile) : mobile;
    if (isEmpty(ctx.mobile)) ctx.mobile = to;

    const plan = { code, tmpl, ctx, to, problems: [] };
    if (isEmpty(tmpl.prvdr_tmplt_id_tx)) plan.problems.push(`Template ${code} has no MSG91 template id (prvdr_tmplt_id_tx)`);
    if (isEmpty(to)) plan.problems.push('No mobile number: pass one, or pass userId in the data');
    else if (!isScalar(to)) plan.problems.push('Invalid mobile number: not a number');
    else {
        const v = validateMobile(to);
        plan.mobile = v.mobile;
        if (!v.valid) plan.problems.push(`Invalid mobile number: ${v.error}`);
    }

    const built = buildVariables(tmpl, ctx, defs);
    const rendered = renderTemplate(tmpl.body_tx, built.variables);
    plan.variables = built.variables;
    plan.variableProblems = built.problems;
    plan.text = rendered.body;
    if (rendered.missing.length) {
        const why = built.problems.filter((p) => rendered.missing.some((m) => p.startsWith(m + ':')));
        plan.problems.push(`Missing template variables: ${rendered.missing.join(', ')}` + (why.length ? ` (${why.join(' | ')})` : ''));
    }
    return plan;
}

/* --------------------------------- API ---------------------------------- */

/**
 * Send one template to one mobile number.
 *
 * @param {string} templateCode  tmplt_cd of an active row in sms_tmplt_lst_t
 * @param {string|number|null} mobile  recipient; null/'' = the user in data.userId
 * @param {object} data  the values the template's variable rows read from.
 *                       Pass userId / ownerUserId to also get user.* / owner.*
 * @returns {Promise<{success, status, mock, msgId, text, error}>}  never rejects
 */
async function send(templateCode, mobile, data = {}) {
    let msgId = null;
    try {
        const plan = await prepare(templateCode, mobile, data);
        if (plan.skipped) return { success: false, status: 'SKIPPED', mock: false, msgId: null, error: plan.error };
        if (!plan.tmpl) return { success: false, status: 'FAILED', mock: false, msgId: null, error: plan.error };

        // Nothing to log when there is no usable recipient at all.
        if (plan.mobile === undefined) {
            console.error(`[messages] ${plan.code} not sent: ${plan.problems.join('; ')}`);
            return { success: false, status: 'FAILED', mock: false, msgId: null, text: plan.text, error: plan.problems.join('; ') };
        }

        const tmpl = plan.tmpl;
        try {
            const ins = await smsMdl.insertMsgLogMdl({
                templateId: tmpl.tmplt_id,
                providerTemplateId: tmpl.prvdr_tmplt_id_tx,
                mobile: plan.mobile,
                variables: plan.variables,
                renderedBody: plan.text,
                senderId: tmpl.sndr_id_tx,
                status: 'PENDING',
                usrId: (plan.ctx.user && plan.ctx.user.id) || undefined,
            });
            msgId = ins.insertId;
        } catch (e) {
            console.error('[messages] could not write sms_msg_log_t:', errText(e)); // still try to send
        }

        const finish = async (out) => {
            if (msgId) {
                await smsMdl.updateMsgLogStatusMdl({
                    msgId, status: out.status, error: out.error, isMock: out.mock,
                    providerMsgId: out.providerMsgId, providerResponse: out.response,
                }).catch((e) => console.error('[messages] could not update sms_msg_log_t:', errText(e)));
            }
            if (!out.success) console.error(`[messages] ${plan.code} not sent: ${out.error}`);
            return { success: out.success, status: out.status, mock: !!out.mock, msgId, text: plan.text, error: out.error || null };
        };

        if (plan.problems.length) return finish({ success: false, status: 'FAILED', error: plan.problems.join('; ') });

        // Hand it to MSG91: the template id plus the same values, one per variable.
        const body = {
            template_id: String(tmpl.prvdr_tmplt_id_tx).trim(),
            recipients: [Object.assign({ mobiles: plan.mobile }, plan.variables)],
        };
        if (!isEmpty(tmpl.sndr_id_tx)) body.sender = tmpl.sndr_id_tx;

        if (msg91.isMockMode()) {
            console.log(`[messages] MOCK (no MSG91_AUTH_KEY) ${plan.code} -> ${plan.mobile}: ${plan.text}`);
            return finish({ success: true, status: 'MOCK', mock: true });
        }
        try {
            const response = await msg91.sendFlow(body);
            return finish({
                success: true, status: 'SENT', response,
                providerMsgId: (response && (response.request_id || response.message)) || null,
            });
        } catch (e) {
            return finish({ success: false, status: 'FAILED', error: errText(e), response: e && e.response });
        }
    } catch (e) {
        console.error(`[messages] ${templateCode} failed:`, errText(e));
        return { success: false, status: 'FAILED', mock: false, msgId, error: errText(e) };
    }
}

/**
 * Show exactly what send() would send — the template text with the real values
 * put in — WITHOUT sending or logging anything.
 *
 * @returns {Promise<{template, provider_template_id, mobile, variables, text,
 *                    length, problems, would_send, error}>}
 */
async function preview(templateCode, mobile, data = {}) {
    const plan = await prepare(templateCode, mobile, data);
    if (!plan.tmpl) return { template: templateCode, would_send: false, problems: [plan.error], error: plan.error };
    // every unfilled variable explained, plus anything else that would stop the send
    const problems = plan.variableProblems.concat(plan.problems.filter((p) => !p.startsWith('Missing template variables')));
    return {
        template: plan.code,
        provider_template_id: plan.tmpl.prvdr_tmplt_id_tx,
        sender: plan.tmpl.sndr_id_tx || null,
        mobile: plan.mobile || null,
        variables: plan.variables,
        text: plan.text,
        length: plan.text.length,
        problems,
        would_send: plan.problems.length === 0,
    };
}

/**
 * Look for mistakes in the template / variable rows and report them in plain
 * words. Run it after inserting rows:  node database/check_sms_setup.js
 *
 * @returns {Promise<{ok: boolean, errors: string[], warnings: string[], summary}>}
 */
async function checkSetup() {
    const errors = [];
    const warnings = [];
    const all = await smsMdl.getSetupSnapshotMdl();
    const templates = all.templates || [];
    const vars = all.variables || [];

    templates.forEach((t) => {
        const name = t.tmplt_cd || `#${t.tmplt_id}`;
        if (!t.a_in) return;
        if (isEmpty(t.tmplt_cd)) errors.push(`Template #${t.tmplt_id} (${t.tmplt_nm_tx || 'unnamed'}) has no tmplt_cd, so it cannot be sent`);
        if (isEmpty(t.prvdr_tmplt_id_tx)) errors.push(`Template ${name}: MSG91 template id (prvdr_tmplt_id_tx) is empty`);
        else if (!/^[0-9a-f]{24}$/i.test(String(t.prvdr_tmplt_id_tx).trim())) {
            warnings.push(`Template ${name}: "${t.prvdr_tmplt_id_tx}" does not look like a MSG91 template id (24 letters/digits)`);
        }
        if (isEmpty(t.body_tx)) errors.push(`Template ${name}: body text is empty`);
        if (/\{#\s*var\s*#\}/i.test(String(t.body_tx || ''))) {
            errors.push(`Template ${name}: body uses DLT style {#var#}; write the MSG91 names instead, e.g. ##var1##`);
        }
        if (isEmpty(t.sndr_id_tx)) warnings.push(`Template ${name}: no sender id (sndr_id_tx)`);

        const known = TEMPLATES[t.tmplt_cd];
        const allowed = COMMON_KEYS.concat(known ? known.keys : []);
        const used = placeholdersIn(t.body_tx);
        const mine = vars.filter((v) => Number(v.tmplt_id) === Number(t.tmplt_id) && v.a_in);
        const names = mine.map((v) => String(v.var_nm_tx).trim());
        used.forEach((p) => {
            if (!names.includes(p)) {
                const near = names.find((n) => n.toLowerCase() === p.toLowerCase());
                errors.push(`Template ${name}: ##${p}## has no variable row` + (near ? ` (there is "${near}" — names are case-sensitive)` : ''));
            }
        });
        mine.forEach((v) => {
            const vn = String(v.var_nm_tx).trim();
            if (!used.includes(vn)) warnings.push(`Template ${name}: variable "${vn}" is defined but ##${vn}## is not in the body text`);
            if (isEmpty(v.src_ky_tx) && isEmpty(v.dflt_vl_tx)) errors.push(`Template ${name}: variable "${vn}" has neither a source key nor a default value`);
            const f = String(v.frmt_cd || 'text').toLowerCase();
            if (!FORMATS.includes(f)) errors.push(`Template ${name}: variable "${vn}" has unknown format "${v.frmt_cd}" (use ${FORMATS.join(', ')})`);
            if (known && !isEmpty(v.src_ky_tx) && !allowed.includes(String(v.src_ky_tx).trim())) {
                const msg = `Template ${name}: variable "${vn}" reads "${v.src_ky_tx}", which the application does not pass for this template`;
                if (isEmpty(v.dflt_vl_tx)) errors.push(msg + ' and it has no default');
                else warnings.push(msg + ` (the default "${v.dflt_vl_tx}" will always be used)`);
            }
        });
        if (!known && !isEmpty(t.tmplt_cd)) {
            warnings.push(`Template ${name}: nothing in the application sends it yet — call messages.send('${t.tmplt_cd}', mobile, data) where it is needed`);
        }
    });

    Object.keys(TEMPLATES).forEach((code) => {
        if (TEMPLATES[code].required && !templates.some((t) => t.tmplt_cd === code && t.a_in)) {
            errors.push(`Template ${code}: no active row in sms_tmplt_lst_t — users cannot receive their OTP`);
        }
    });

    return {
        ok: errors.length === 0,
        errors,
        warnings,
        summary: {
            templates: templates.filter((t) => t.a_in).length,
            variables: vars.filter((v) => v.a_in).length,
        },
    };
}

module.exports = {
    send, preview, checkSetup,
    TEMPLATES, COMMON_KEYS, FORMATS, DLT_VARIABLE_MAX,
    formatValue, readPath, placeholdersIn, renderTemplate, normalizeMobile, validateMobile,
};
