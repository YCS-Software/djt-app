/**
 * MSG91 SMS gateway configuration — SERVER-SIDE ONLY.
 *
 * The MSG91 auth key lives here (sourced from environment variables) and must NEVER
 * be sent to or stored in the frontend. SMS are sent through MSG91's v5 "Flow" API,
 * which delivers DLT-approved templates by id and substitutes the template variables
 * (e.g. ##var1##) from the values supplied per recipient.
 *
 * Docs: https://docs.msg91.com/reference/send-sms  (POST /api/v5/flow/)
 */

// Only the secret auth key lives in the environment. Sender id, country code and
// the default OTP template id are stored in the DB (sms_cnfg_t) and resolved by
// utils/smsUtil.js.
const AUTH_KEY = process.env.MSG91_AUTH_KEY || "";

const FLOW_URL = "https://control.msg91.com/api/v5/flow/";

/**
 * Mock mode when no auth key is configured. Keeps local/dev working without sending
 * real SMS (the payload is logged by the caller instead).
 */
function isMockMode() {
  return !AUTH_KEY;
}

/**
 * Low-level call to the MSG91 Flow API. Returns the parsed JSON response.
 * Throws on a non-2xx HTTP status or a MSG91 `type: "error"` body.
 *
 * @param {object} body - the exact JSON body MSG91 expects
 *   { template_id, sender?, recipients: [{ mobiles, var1, var2, ... }] }
 * @returns {Promise<object>} parsed MSG91 response
 */
async function sendFlow(body) {
  if (isMockMode()) {
    throw new Error("MSG91 is in mock mode (MSG91_AUTH_KEY not set)");
  }

  const res = await fetch(FLOW_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      accept: "application/json",
      authkey: AUTH_KEY,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch (e) {
    json = { raw: text };
  }

  if (!res.ok || (json && json.type === "error")) {
    const msg = (json && (json.message || json.msg)) || `HTTP ${res.status}`;
    const err = new Error(`MSG91 send failed: ${msg}`);
    err.status = res.status;
    err.response = json;
    throw err;
  }

  return json;
}

module.exports = {
  isMockMode,
  sendFlow,
};
