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
const ocppLog = require('./ocppLogMdl');

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

// Best-effort audit of one OCPP message / lifecycle event (fire-and-forget).
// Enriches every record with the current connection's machine/station/remote addr.
function logMsg(conn, rec) {
    ocppLog.logOcppMessage(Object.assign({
        ocppId: conn.ocppId,
        machineId: conn.machineId,
        stationId: conn.stationId,
        remoteAddr: conn.remoteAddr,
    }, rec));
}

// CSMS -> CP request; resolves with the CP's CALLRESULT payload
function sendCall(conn, action, payload) {
    return new Promise((resolve, reject) => {
        const id = crypto.randomUUID();
        const timer = setTimeout(() => {
            conn.pendingCalls.delete(id);
            logMsg(conn, { direction: 'sys', messageType: 'ERROR', messageId: id, action,
                errorCode: 'Timeout', errorDesc: `OCPP call ${action} timed out` });
            reject(new Error(`OCPP call ${action} timed out`));
        }, CALL_TIMEOUT_MS);
        conn.pendingCalls.set(id, { resolve, reject, timer, action, startTime: Date.now() });
        logMsg(conn, { direction: 'out', messageType: 'CALL', messageId: id, action, payload: payload || {} });
        send(conn, [CALL, id, action, payload || {}]);
    });
}

async function handleCall(conn, frame) {
    const [, id, action, payload] = frame;
    // Audit the inbound request (CP -> CSMS)
    logMsg(conn, { direction: 'in', messageType: 'CALL', messageId: id, action, payload: payload || {} });

    const handler = handlers[action];
    if (!handler) {
        console.warn(`[OCPP] ${conn.ocppId} -> unsupported action ${action}`);
        logMsg(conn, { direction: 'out', messageType: 'CALLERROR', messageId: id, action,
            errorCode: 'NotImplemented', errorDesc: `Action ${action} not supported` });
        send(conn, [CALLERROR, id, 'NotImplemented', `Action ${action} not supported`, {}]);
        return;
    }
    try {
        const ctx = { conn, registry, ocppMdl, nowIso, OcppError };
        const responsePayload = (await handler(payload || {}, ctx)) || {};
        // Audit the outbound response (CSMS -> CP)
        logMsg(conn, { direction: 'out', messageType: 'CALLRESULT', messageId: id, action, payload: responsePayload });
        send(conn, [CALLRESULT, id, responsePayload]);
    } catch (err) {
        const code = err instanceof OcppError ? err.code : 'InternalError';
        console.error(`[OCPP] ${conn.ocppId} ${action} handler error:`, err.message);
        logMsg(conn, { direction: 'out', messageType: 'CALLERROR', messageId: id, action,
            errorCode: code, errorDesc: err.message || 'Handler error', payload: err.details || {} });
        send(conn, [CALLERROR, id, code, err.message || 'Handler error', err.details || {}]);
    }
}

function handleResult(conn, frame, isError) {
    const id = frame[1];
    const pending = conn.pendingCalls.get(id);
    const action = pending ? pending.action : null;
    const latencyMs = pending && pending.startTime ? (Date.now() - pending.startTime) : null;
    // Audit the inbound response to a CSMS-initiated CALL, with round-trip latency
    if (isError) {
        logMsg(conn, { direction: 'in', messageType: 'CALLERROR', messageId: id, action,
            errorCode: frame[2], errorDesc: frame[3], payload: frame[4] || {}, latencyMs });
    } else {
        logMsg(conn, { direction: 'in', messageType: 'CALLRESULT', messageId: id, action, payload: frame[2], latencyMs });
    }
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
        logMsg(conn, { direction: 'sys', messageType: 'ERROR', errorCode: 'RpcFrameworkError',
            errorDesc: 'Invalid JSON', payload: { raw: raw.toString().slice(0, 500) } });
        return send(conn, [CALLERROR, '-1', 'RpcFrameworkError', 'Invalid JSON', {}]);
    }
    if (!Array.isArray(frame) || frame.length < 2) {
        logMsg(conn, { direction: 'sys', messageType: 'ERROR', errorCode: 'RpcFrameworkError',
            errorDesc: 'Malformed frame', payload: { frame } });
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

        const remoteAddr = (req.headers['x-forwarded-for'] ? String(req.headers['x-forwarded-for']).split(',')[0].trim() : null)
            || (req.socket && req.socket.remoteAddress) || null;

        const conn = {
            ocppId,
            ws,
            machineId: null,
            stationId: null,
            pricePerKwh: 0,
            authorizedUser: null,
            remoteAddr,
            connectedAt: Date.now(),
            lastSeen: Date.now(),
            pendingCalls: new Map(),
        };
        registry.set(ocppId, conn);
        console.log(`[OCPP] Charge point connected: ${ocppId} (${registry.size} online)`);
        logMsg(conn, { direction: 'sys', messageType: 'CONNECT',
            payload: { subprotocol: ws.protocol || null, path: req.url || null } });

        ws.on('message', (raw) => onMessage(conn, raw));
        ws.on('error', (e) => {
            console.error(`[OCPP] ${ocppId} socket error:`, e.message);
            logMsg(conn, { direction: 'sys', messageType: 'ERROR', errorCode: 'SocketError', errorDesc: e.message });
        });
        ws.on('close', async (code, reason) => {
            registry.delete(ocppId);
            conn.pendingCalls.forEach((p) => { clearTimeout(p.timer); p.reject(new Error('Connection closed')); });
            console.log(`[OCPP] Charge point disconnected: ${ocppId} (${registry.size} online)`);
            logMsg(conn, { direction: 'sys', messageType: 'DISCONNECT',
                payload: { code: code || null, reason: reason ? reason.toString() : null } });
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
