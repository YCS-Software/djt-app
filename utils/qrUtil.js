/**
 * QR Token Utility
 * Builds and verifies the signed, app-only token embedded in a machine's QR code.
 *
 * Format:  DJTEV1.<base64url(payload JSON)>.<base64url(HMAC-SHA256)>
 *
 * A generic QR scanner only sees opaque text (no URL, no readable data), so it
 * cannot act on the code. Only this app — via the server resolve endpoint, which
 * holds the secret — can verify the signature and decode the payload. A forged or
 * tampered payload fails the HMAC check and is rejected.
 */

const crypto = require('crypto');
const config = require(appRoot + '/config/config');

const PREFIX = 'DJTEV1';

function secret() {
    return (config.qr && config.qr.secret) || process.env.QR_SECRET || (config.jwt && config.jwt.secret) || 'djt-qr-secret';
}

function b64url(buf) {
    return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s) {
    s = String(s).replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    return Buffer.from(s, 'base64');
}

function sign(body) {
    return b64url(crypto.createHmac('sha256', secret()).update(body).digest());
}

// Build a signed token from a payload object
exports.encode = function(payloadObj) {
    const body = b64url(JSON.stringify(payloadObj));
    return `${PREFIX}.${body}.${sign(body)}`;
};

// Verify + decode a token. Returns the payload object, or null if invalid/tampered.
exports.decode = function(token) {
    if (typeof token !== 'string') return null;
    const parts = token.trim().split('.');
    if (parts.length !== 3 || parts[0] !== PREFIX) return null;
    const body = parts[1];
    const expected = sign(body);
    const a = Buffer.from(parts[2]);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    try {
        return JSON.parse(fromB64url(body).toString('utf8'));
    } catch (e) {
        return null;
    }
};

exports.PREFIX = PREFIX;
