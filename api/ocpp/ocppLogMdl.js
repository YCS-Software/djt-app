/**
 * OCPP message log model
 * ----------------------------------------------------------------------------
 * Read/write access to ocpp_msg_log_t — the request/response audit trail for the
 * OCPP WebSocket channel used by external charger vendors.
 *
 * Writes are best-effort and fire-and-forget: a logging failure must never break
 * the live OCPP protocol flow. All values are bound (`?`) — no concatenation.
 */

const sqldb = require(appRoot + '/config/db.config');
const pool = sqldb.pool;

/**
 * Record one OCPP message / lifecycle event. Always resolves (never rejects).
 * @param {Object} r
 * @param {string} r.ocppId       charge point identity
 * @param {number} [r.machineId]  resolved machine id
 * @param {number} [r.stationId]  resolved station id
 * @param {string} r.direction    'in' | 'out' | 'sys'
 * @param {string} r.messageType  CALL | CALLRESULT | CALLERROR | CONNECT | DISCONNECT | ERROR
 * @param {string} [r.messageId]  OCPP message id (for request/response correlation)
 * @param {string} [r.action]     OCPP action name
 * @param {*}      [r.payload]    message payload (serialised to JSON)
 * @param {string} [r.errorCode]
 * @param {string} [r.errorDesc]
 * @param {number} [r.latencyMs]
 * @param {string} [r.remoteAddr]
 */
async function logOcppMessage(r) {
    try {
        if (!r || !r.ocppId || !r.direction || !r.messageType) return;
        let payload = null;
        if (r.payload != null) {
            try { payload = JSON.stringify(r.payload); } catch { payload = null; }
        }
        await pool.execute(
            `INSERT INTO ocpp_msg_log_t
                (ocpp_id_tx, mchn_id, sttn_id, drctn_cd, msg_typ_cd, ocpp_msg_id_tx,
                 actn_tx, payld_json, err_cd_tx, err_desc_tx, ltncy_ms_nbr, rmt_addr_tx)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                String(r.ocppId).slice(0, 100),
                r.machineId != null ? r.machineId : null,
                r.stationId != null ? r.stationId : null,
                String(r.direction).slice(0, 10),
                String(r.messageType).slice(0, 20),
                r.messageId != null ? String(r.messageId).slice(0, 100) : null,
                r.action != null ? String(r.action).slice(0, 60) : null,
                payload,
                r.errorCode != null ? String(r.errorCode).slice(0, 60) : null,
                r.errorDesc != null ? String(r.errorDesc) : null,
                Number.isFinite(+r.latencyMs) ? Math.max(0, parseInt(r.latencyMs, 10)) : null,
                r.remoteAddr != null ? String(r.remoteAddr).slice(0, 45) : null,
            ]
        );
    } catch (e) {
        console.error('[ocppLog] write failed:', e && e.message ? e.message : e);
    }
}

/**
 * List OCPP message logs (admin/owner monitoring), newest first.
 * Filters are optional; LIMIT/OFFSET are validated integers (never bound).
 */
async function listOcppLogs(filters = {}) {
    const where = [];
    const params = [];
    if (filters.ocppId)    { where.push('ocpp_id_tx = ?'); params.push(String(filters.ocppId)); }
    if (filters.machineId) { where.push('mchn_id = ?');    params.push(parseInt(filters.machineId, 10) || 0); }
    if (filters.action)    { where.push('actn_tx = ?');    params.push(String(filters.action)); }
    if (filters.direction) { where.push('drctn_cd = ?');   params.push(String(filters.direction)); }
    if (filters.messageId) { where.push('ocpp_msg_id_tx = ?'); params.push(String(filters.messageId)); }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const limit = Number.isFinite(+filters.limit) && +filters.limit ? Math.min(500, Math.max(1, parseInt(filters.limit, 10))) : 100;
    const offset = Number.isFinite(+filters.offset) && +filters.offset ? Math.max(0, parseInt(filters.offset, 10)) : 0;

    const [rows] = await pool.execute(
        `SELECT msg_log_id, ocpp_id_tx, mchn_id, sttn_id, drctn_cd, msg_typ_cd,
                ocpp_msg_id_tx, actn_tx, payld_json, err_cd_tx, err_desc_tx,
                ltncy_ms_nbr, rmt_addr_tx, i_ts
           FROM ocpp_msg_log_t
           ${whereSql}
           ORDER BY msg_log_id DESC
           LIMIT ${limit} OFFSET ${offset}`,
        params
    );
    return rows;
}

module.exports = { logOcppMessage, listOcppLogs };
