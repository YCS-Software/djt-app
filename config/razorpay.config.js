/**
 * Razorpay configuration — SERVER-SIDE ONLY.
 *
 * All Razorpay credentials live here (sourced from environment variables) and must
 * NEVER be sent to or stored in the frontend. The only value the client ever receives
 * is the *publishable* key id (`key_id`), returned at runtime from the create-order
 * endpoint — that is required by the Razorpay checkout widget and is safe to expose.
 * The key secret and webhook secret stay on the server exclusively.
 */

const crypto = require('crypto');

const KEY_ID = process.env.RAZORPAY_KEY_ID || '';
// Support both env names that have been used in this project.
const KEY_SECRET = process.env.RAZORPAY_SECRET_KEY || process.env.RAZORPAY_KEY_SECRET || '';
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || '';

/** Whether usable gateway credentials are configured. */
function isConfigured() {
    return !!(KEY_ID && KEY_SECRET);
}

/** The publishable key id — the ONLY credential the client may receive. */
function getPublicKeyId() {
    return KEY_ID;
}

/**
 * Build a Razorpay SDK instance. Throws if credentials are not configured —
 * there is no mock fallback; payments always go through the real gateway.
 */
function getInstance() {
    if (!isConfigured()) {
        throw { err_status: 503, err_message: 'Payment gateway not configured (missing RAZORPAY_KEY_ID / RAZORPAY_SECRET_KEY)' };
    }
    const Razorpay = require('razorpay');
    return new Razorpay({ key_id: KEY_ID, key_secret: KEY_SECRET });
}

/**
 * Verify a Razorpay checkout signature: HMAC_SHA256(order_id|payment_id, key_secret).
 * @returns {boolean}
 */
function verifyPaymentSignature(orderId, paymentId, signature) {
    if (!KEY_SECRET || !signature) return false;
    const expected = crypto.createHmac('sha256', KEY_SECRET)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');
    // constant-time compare
    const a = Buffer.from(expected);
    const b = Buffer.from(String(signature));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Verify a Razorpay *webhook* signature: HMAC_SHA256(rawBody, webhook_secret).
 * @param {string|Buffer} rawBody - the exact raw request body bytes
 * @param {string} signature - value of the `x-razorpay-signature` header
 * @returns {boolean}
 */
function verifyWebhookSignature(rawBody, signature) {
    if (!WEBHOOK_SECRET) return false; // no secret configured -> cannot verify
    if (!signature) return false;
    const expected = crypto.createHmac('sha256', WEBHOOK_SECRET)
        .update(rawBody)
        .digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(String(signature));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function isWebhookConfigured() {
    return !!WEBHOOK_SECRET;
}

module.exports = {
    isConfigured,
    getPublicKeyId,
    getInstance,
    verifyPaymentSignature,
    verifyWebhookSignature,
    isWebhookConfigured,
};
