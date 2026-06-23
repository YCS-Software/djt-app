/**
 * OCPP 2.0.1 WebSocket server (CSMS side)
 *
 * Charge points connect to:  ws://<host>:<port>/ocpp/<chargePointId>
 * with subprotocol "ocpp2.0.1". Messages use the OCPP-J framing:
 *   CALL       [2, messageId, action, payload]
 *   CALLRESULT [3, messageId, payload]
 *   CALLERROR  [4, messageId, errorCode, errorDescription, errorDetails]
 */

const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const handlers = require('./ocppHandlers');
const ocppMdl = require('./ocppMdl');

const CALL = 2;
const CALLRESULT = 3;
const CALLERROR = 4;
const CALL_TIMEOUT_MS = 30000;

// ocppId -> connection context
const registry = new Map();

class OcppError extends Error {
    constructor(code, message, details) {
        super(message || code);
        this.code = code || 'InternalError';
        this.details = details || {};
    }
}

function nowIso() {
    return new Date().toISOString();
}

function send(conn, frame) {
    try {
        conn.ws.send(JSON.stringify(frame));
    } catch (e) {
        console.error(`[OCPP] send failed to ${conn.ocppId}:`, e.message);
    }
}

// CSMS -> CP request; resolves with the CP's CALLRESULT payload
function sendCall(conn, action, payload) {
    return new Promise((resolve, reject) => {
        const id = crypto.randomUUID();
        const timer = setTimeout(() => {
            conn.pendingCalls.delete(id);
            reject(new Error(`OCPP call ${action} timed out`));
        }, CALL_TIMEOUT_MS);
        conn.pendingCalls.set(id, { resolve, reject, timer, action });
        send(conn, [CALL, id, action, payload || {}]);
    });
}

async function handleCall(conn, frame) {
    const [, id, action, payload] = frame;
    const handler = handlers[action];
    if (!handler) {
        console.warn(`[OCPP] ${conn.ocppId} -> unsupported action ${action}`);
        send(conn, [CALLERROR, id, 'NotImplemented', `Action ${action} not supported`, {}]);
        return;
    }
    try {
        const ctx = { conn, registry, ocppMdl, nowIso, OcppError };
        const responsePayload = (await handler(payload || {}, ctx)) || {};
        send(conn, [CALLRESULT, id, responsePayload]);
    } catch (err) {
        const code = err instanceof OcppError ? err.code : 'InternalError';
        console.error(`[OCPP] ${conn.ocppId} ${action} handler error:`, err.message);
        send(conn, [CALLERROR, id, code, err.message || 'Handler error', err.details || {}]);
    }
}

function handleResult(conn, frame, isError) {
    const id = frame[1];
    const pending = conn.pendingCalls.get(id);
    if (!pending) return;
    conn.pendingCalls.delete(id);
    clearTimeout(pending.timer);
    if (isError) {
        pending.reject(new Error(`${frame[2]}: ${frame[3]}`));
    } else {
        pending.resolve(frame[2]);
    }
}

async function onMessage(conn, raw) {
    let frame;
    try {
        frame = JSON.parse(raw.toString());
    } catch {
        return send(conn, [CALLERROR, '-1', 'RpcFrameworkError', 'Invalid JSON', {}]);
    }
    if (!Array.isArray(frame) || frame.length < 2) {
        return send(conn, [CALLERROR, '-1', 'RpcFrameworkError', 'Malformed frame', {}]);
    }
    conn.lastSeen = Date.now();
    switch (frame[0]) {
        case CALL: return handleCall(conn, frame);
        case CALLRESULT: return handleResult(conn, frame, false);
        case CALLERROR: return handleResult(conn, frame, true);
        default:
            return send(conn, [CALLERROR, frame[1] || '-1', 'RpcFrameworkError', 'Unknown message type', {}]);
    }
}

function parseOcppId(url) {
    // /ocpp/<id>  (id may be url-encoded)
    const clean = (url || '').split('?')[0].replace(/\/+$/, '');
    const m = clean.match(/^\/ocpp\/(.+)$/);
    return m ? decodeURIComponent(m[1]) : null;
}

function attachOcpp(server) {
    const wss = new WebSocketServer({
        server,
        path: undefined, // accept any path; we validate /ocpp/ ourselves
        handleProtocols: (protocols) => (protocols.has('ocpp2.0.1') ? 'ocpp2.0.1' : false),
    });

    wss.on('connection', (ws, req) => {
        const ocppId = parseOcppId(req.url);
        if (!ocppId) {
            ws.close(1008, 'Invalid OCPP path; expected /ocpp/<chargePointId>');
            return;
        }

        // Replace any stale connection for the same charge point
        const existing = registry.get(ocppId);
        if (existing) {
            try { existing.ws.close(1012, 'Reconnected'); } catch { /* ignore */ }
        }

        const conn = {
            ocppId,
            ws,
            machineId: null,
            stationId: null,
            pricePerKwh: 0,
            authorizedUser: null,
            connectedAt: Date.now(),
            lastSeen: Date.now(),
            pendingCalls: new Map(),
        };
        registry.set(ocppId, conn);
        console.log(`[OCPP] Charge point connected: ${ocppId} (${registry.size} online)`);

        ws.on('message', (raw) => onMessage(conn, raw));
        ws.on('error', (e) => console.error(`[OCPP] ${ocppId} socket error:`, e.message));
        ws.on('close', async () => {
            registry.delete(ocppId);
            conn.pendingCalls.forEach((p) => { clearTimeout(p.timer); p.reject(new Error('Connection closed')); });
            console.log(`[OCPP] Charge point disconnected: ${ocppId} (${registry.size} online)`);
            if (conn.machineId) {
                try { await ocppMdl.setMachineStatusMdl(conn.machineId, 'offline'); } catch (e) { /* ignore */ }
            }
        });
    });

    console.log('🔌 OCPP 2.0.1 WebSocket server attached at /ocpp/<chargePointId>');
    return wss;
}

// --- helpers for the REST control layer ---

function listConnections() {
    return Array.from(registry.values()).map((c) => ({
        ocpp_id: c.ocppId,
        machine_id: c.machineId,
        station_id: c.stationId,
        connected_at: new Date(c.connectedAt).toISOString(),
        last_seen: new Date(c.lastSeen).toISOString(),
        authorized_user: c.authorizedUser ? c.authorizedUser.usr_id : null,
    }));
}

function getConnection(ocppId) {
    return registry.get(ocppId) || null;
}

module.exports = { attachOcpp, sendCall, listConnections, getConnection, registry };
