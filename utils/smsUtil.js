/**
 * Centralized SMS utility (server-side).
 *
 * Single entry point for sending SMS anywhere in the app. Callers hand it a payload
 * describing *what* to send and *to whom*; this module normalizes the recipients,
 * maps the template variables, and dispatches through the MSG91 Flow API.
 *
 * Usage:
 *   const sms = require(appRoot + '/utils/smsUtil');
 *
 *   // 1) Single recipient with explicit template + variables
 *   await sms.sendSMS({
 *     mobile: '9999999999',
 *     templateId: '6a3a2c9e142b52e3340a24c3',
 *     variables: { var1: '1234' },
 *   });
 *
 *   // 2) Many recipients in one call (each with its own variables)
 *   await sms.sendSMS({
 *     templateId: '6a3a2c9e142b52e3340a24c3',
 *     recipients: [
 *       { mobile: '9999999999', variables: { var1: '1234' } },
 *       { mobile: '8888888888', variables: { var1: '5678' } },
 *     ],
 *   });
 *
 *   // 3) Convenience helper for the OTP template
 *   await sms.sendOTP('9999999999', '1234');
 *
 * Every call resolves to: { success: boolean, mock: boolean, response: object|null }
 * and never throws for an individual delivery failure — instead it returns
 * { success: false, error } so callers can decide how to react (the OTP flow, for
 * example, should not 500 just because the SMS gateway hiccuped).
 */

const msg91 = require(appRoot + "/config/msg91.config");
const smsMdl = require(appRoot + "/api/modules/sms/models/smsMdl");

// Fallback country code used only if the DB settings can't be read.
const FALLBACK_COUNTRY_CODE = "91";

// In-memory cache of the DB-backed gateway settings (sms_cnfg_t).
let _settingsCache = null;

/**
 * Load gateway settings (sender id, country code, default OTP template id) from
 * the DB, caching the result. Call clearSettingsCache() after changing config.
 * @returns {Promise<{senderId: string, countryCode: string, otpTemplateId: string}>}
 */
async function getSmsSettings() {
  if (_settingsCache) return _settingsCache;
  let map = {};
  try {
    const rows = await smsMdl.getConfigMdl();
    (rows || []).forEach((r) => {
      map[r.cnfg_ky_tx] = r.cnfg_vl_tx;
    });
  } catch (e) {
    console.error(
      "[smsUtil] could not load sms_cnfg_t, using fallbacks:",
      e.message || e,
    );
  }
  _settingsCache = {
    senderId: map.DEFAULT_SENDER_ID || "",
    countryCode: map.DEFAULT_COUNTRY_CODE || FALLBACK_COUNTRY_CODE,
    otpTemplateId: map.DEFAULT_OTP_TEMPLATE_ID || "",
  };
  return _settingsCache;
}

/** Invalidate the settings cache (after a config update). */
function clearSettingsCache() {
  _settingsCache = null;
}

/**
 * Normalize a mobile number to MSG91's expected "countrycode + number" form.
 * - strips spaces, dashes, leading "+" and "0"
 * - prepends the given country code to a bare 10-digit number
 * @param {string|number} mobile
 * @param {string} [countryCode] - defaults to FALLBACK_COUNTRY_CODE for sync callers
 * @returns {string}
 */
function normalizeMobile(mobile, countryCode = FALLBACK_COUNTRY_CODE) {
  let m = String(mobile || "").replace(/[\s\-()]/g, "");
  m = m.replace(/^\+/, "");
  // drop a single leading 0 (common in locally-entered numbers)
  m = m.replace(/^0+/, "");
  // bare 10-digit number -> prepend country code
  if (m.length === 10) {
    m = countryCode + m;
  }
  return m;
}

/**
 * Build one MSG91 recipient object: { mobiles, var1, var2, ... }.
 * @param {string|number} mobile
 * @param {object} variables - template variable map, e.g. { var1: '1234' }
 * @param {string} countryCode
 */
function buildRecipient(mobile, variables, countryCode) {
  const recipient = { mobiles: normalizeMobile(mobile, countryCode) };
  if (variables && typeof variables === "object") {
    for (const [key, value] of Object.entries(variables)) {
      recipient[key] = value;
    }
  }
  return recipient;
}

/**
 * Normalize the caller payload into a flat list of recipients.
 * Supports both the single-recipient shape ({ mobile, variables }) and the
 * multi-recipient shape ({ recipients: [...] }).
 */
function resolveRecipients(payload, countryCode) {
  if (Array.isArray(payload.recipients) && payload.recipients.length > 0) {
    return payload.recipients.map((r) =>
      buildRecipient(r.mobile || r.mobiles, r.variables || r.vars, countryCode),
    );
  }
  if (payload.mobile || payload.mobiles) {
    return [
      buildRecipient(
        payload.mobile || payload.mobiles,
        payload.variables || payload.vars,
        countryCode,
      ),
    ];
  }
  return [];
}

/**
 * Send an SMS (or a batch) through MSG91.
 *
 * @param {object} payload
 * @param {string}   [payload.templateId] - MSG91 template/flow id (defaults to DB DEFAULT_OTP_TEMPLATE_ID)
 * @param {string}   [payload.senderId]   - DLT sender id (defaults to DB DEFAULT_SENDER_ID)
 * @param {string|number} [payload.mobile]    - single recipient mobile number
 * @param {object}   [payload.variables]  - template variables for the single recipient
 * @param {Array}    [payload.recipients] - [{ mobile, variables }, ...] for a batch
 * @returns {Promise<{success: boolean, mock: boolean, response: object|null, error?: string}>}
 */
async function sendSMS(payload = {}) {
  const settings = await getSmsSettings();
  const templateId = payload.templateId || settings.otpTemplateId;
  const senderId = payload.senderId || settings.senderId;
  const countryCode = payload.countryCode || settings.countryCode;
  const recipients = resolveRecipients(payload, countryCode);

  // Validate inputs up front.
  if (!templateId) {
    return {
      success: false,
      mock: false,
      response: null,
      error: "No templateId provided and no default configured",
    };
  }
  if (recipients.length === 0) {
    return {
      success: false,
      mock: false,
      response: null,
      error: "No recipient mobile number provided",
    };
  }

  const body = { template_id: templateId, recipients };
  if (senderId) body.sender = senderId;

  // Mock mode: log instead of sending, so local/dev works without credentials.
  if (msg91.isMockMode()) {
    console.log("\n📨 [smsUtil] MOCK MODE — SMS not sent. Payload:");
    console.log(JSON.stringify(body, null, 2), "\n");
    return { success: true, mock: true, response: null };
  }

  try {
    const response = await msg91.sendFlow(body);
    return { success: true, mock: false, response };
  } catch (error) {
    console.error(
      "[smsUtil] sendSMS failed:",
      error.message,
      error.response || "",
    );
    return {
      success: false,
      mock: false,
      response: error.response || null,
      error: error.message,
    };
  }
}

/**
 * Render a template body by substituting ##key## placeholders with the
 * supplied variable values. Returns { body, missing } where `missing` lists
 * any placeholders in the body that had no matching variable.
 *
 * @param {string} body - template body, e.g. "Your OTP is ##var1##"
 * @param {object} variables - { var1: '1234', ... }
 */
function renderTemplate(body, variables = {}) {
  const vars = variables || {};
  const used = new Set();
  const rendered = String(body).replace(/##(\w+)##/g, (match, key) => {
    if (Object.prototype.hasOwnProperty.call(vars, key)) {
      used.add(key);
      return String(vars[key]);
    }
    return match; // leave unknown placeholders untouched
  });

  // Any placeholder left un-substituted = a missing variable.
  const missing = [];
  const re = /##(\w+)##/g;
  let m;
  while ((m = re.exec(rendered)) !== null) {
    if (!missing.includes(m[1])) missing.push(m[1]);
  }
  return { body: rendered, missing };
}

/**
 * Send a message using a template stored in the database, recording a full
 * audit trail in sms_msg_log_t. This is the primary, DB-driven entry point.
 *
 * Flow:
 *   1. Resolve the template (by provider id like "6a3a..." or internal numeric id)
 *   2. Render the body locally by replacing ##varN## with the supplied values
 *   3. Insert a PENDING audit row
 *   4. Dispatch via MSG91 (passing the template id + variables)
 *   5. Update the audit row to SENT / FAILED / MOCK
 *
 * @param {object} payload
 * @param {string|number} payload.template  - provider template id OR internal tmplt_id
 * @param {string|number} payload.mobile    - recipient mobile number
 * @param {object}        payload.variables - { var1: '1234', ... } key/value pairs
 * @param {string}        [payload.senderId]
 * @param {number}        [payload.usrId]   - optional linked user id
 * @returns {Promise<{success, mock, msgId, status, renderedBody, response, error?}>}
 */
async function sendTemplateMessage(payload = {}) {
  const { template, mobile, variables = {}, senderId, usrId } = payload;

  if (!template) {
    return { success: false, status: "FAILED", error: "template is required" };
  }
  if (!mobile) {
    return { success: false, status: "FAILED", error: "mobile is required" };
  }

  // 1) Resolve template — try provider id first, then internal numeric id.
  let tmplRows = await smsMdl.getTemplateByProviderIdMdl(String(template));
  if ((!tmplRows || tmplRows.length === 0) && /^\d+$/.test(String(template))) {
    tmplRows = await smsMdl.getTemplateByIdMdl(parseInt(template, 10));
  }
  const tmpl = tmplRows && tmplRows.length > 0 ? tmplRows[0] : null;
  if (!tmpl) {
    return {
      success: false,
      status: "FAILED",
      error: `Template not found: ${template}`,
    };
  }

  // 2) Render the body locally (for the audit record).
  const settings = await getSmsSettings();
  const { body: renderedBody, missing } = renderTemplate(
    tmpl.body_tx,
    variables,
  );
  const normalizedMobile = normalizeMobile(mobile, settings.countryCode);
  const effectiveSender = senderId || tmpl.sndr_id_tx || settings.senderId;

  // 3) Insert PENDING audit row.
  let msgId = null;
  try {
    const ins = await smsMdl.insertMsgLogMdl({
      templateId: tmpl.tmplt_id,
      providerTemplateId: tmpl.prvdr_tmplt_id_tx,
      mobile: normalizedMobile,
      variables,
      renderedBody,
      senderId: effectiveSender,
      status: "PENDING",
      usrId,
    });
    msgId = ins.insertId;
  } catch (e) {
    console.error("[smsUtil] failed to write audit log:", e.message || e);
    // Continue — we still attempt delivery even if logging failed.
  }

  // Guard: refuse to send if required placeholders weren't supplied.
  if (missing.length > 0) {
    const error = `Missing template variables: ${missing.join(", ")}`;
    if (msgId) {
      await smsMdl
        .updateMsgLogStatusMdl({ msgId, status: "FAILED", error })
        .catch(() => {});
    }
    return { success: false, status: "FAILED", msgId, renderedBody, error };
  }

  // 4) Dispatch via MSG91 (provider substitutes the same vars on its side).
  const sendResult = await sendSMS({
    templateId: tmpl.prvdr_tmplt_id_tx,
    senderId: effectiveSender,
    mobile: normalizedMobile,
    variables,
  });

  // 5) Update the audit row with the outcome.
  const status = sendResult.success
    ? sendResult.mock
      ? "MOCK"
      : "SENT"
    : "FAILED";
  const providerMsgId =
    sendResult.response &&
    (sendResult.response.request_id || sendResult.response.message)
      ? sendResult.response.request_id || sendResult.response.message
      : null;

  if (msgId) {
    await smsMdl
      .updateMsgLogStatusMdl({
        msgId,
        status,
        providerMsgId,
        providerResponse: sendResult.response,
        error: sendResult.error,
        isMock: sendResult.mock,
      })
      .catch((e) =>
        console.error("[smsUtil] failed to update audit log:", e.message || e),
      );
  }

  return {
    success: sendResult.success,
    mock: !!sendResult.mock,
    msgId,
    status,
    renderedBody,
    response: sendResult.response || null,
    error: sendResult.error,
  };
}

/**
 * Convenience wrapper for the OTP template (var1 = the OTP code).
 * DB-driven: resolves the default OTP template and writes an audit row.
 * @param {string|number} mobile
 * @param {string|number} otp
 * @param {object} [opts] - { template, senderId, usrId } overrides
 */
async function sendOTP(mobile, otp, opts = {}) {
  const settings = await getSmsSettings();
  return sendTemplateMessage({
    template: opts.template || settings.otpTemplateId,
    mobile,
    senderId: opts.senderId,
    usrId: opts.usrId,
    variables: { var1: String(otp) },
  });
}

module.exports = {
  sendSMS,
  sendTemplateMessage,
  sendOTP,
  renderTemplate,
  normalizeMobile,
  getSmsSettings,
  clearSettingsCache,
};
