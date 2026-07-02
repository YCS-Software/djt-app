/**
 * Audit utility
 * ----------------------------------------------------------------------------
 * Best-effort, fire-and-forget audit logging into `audt_lst_t`.
 *
 * Auditing must NEVER break the request it is recording, so every write here is
 * wrapped in try/catch and failures are only logged. All values are bound (`?`)
 * — no string concatenation.
 *
 * The double-entry ledger has its own transactional audit (see ledgerMdl.insertAudit)
 * so that money movements and their audit row commit/rollback atomically. This
 * helper is for everything else (auth, sessions, admin/owner CRUD, etc.) where a
 * best-effort pooled write is the right trade-off.
 */

const sqldb = require(appRoot + '/config/db.config');
const pool = sqldb.pool;

/**
 * Write a single audit row. Returns a promise that always resolves (never rejects).
 *
 * @param {Object}  a
 * @param {number}  [a.userId]      acting user id (usr_id), null for anonymous
 * @param {string}   a.action       short action code, e.g. 'login', 'session_start'
 * @param {string}  [a.entityType]  entity kind, e.g. 'user', 'session', 'station'
 * @param {number}  [a.entityId]    affected entity id
 * @param {*}       [a.oldVal]      previous state (serialised to JSON)
 * @param {*}       [a.newVal]      new state / event detail (serialised to JSON)
 * @param {string}  [a.ip]          client IP
 * @param {string}  [a.userAgent]   client user-agent
 */
async function writeAudit(a) {
    try {
        if (!a || !a.action) return;
        const userId = a.userId != null ? a.userId : null;
        await pool.execute(
            `INSERT INTO audt_lst_t
                (usr_id, actn_cd, entty_typ_cd, entty_id, old_vl_json, nw_vl_json, ip_addr_tx, usr_agnt_tx)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                userId,
                String(a.action).slice(0, 50),
                a.entityType != null ? String(a.entityType).slice(0, 50) : null,
                a.entityId != null ? a.entityId : null,
                a.oldVal != null ? JSON.stringify(a.oldVal) : null,
                a.newVal != null ? JSON.stringify(a.newVal) : null,
                a.ip != null ? String(a.ip).slice(0, 45) : null,
                a.userAgent != null ? String(a.userAgent) : null,
            ]
        );
    } catch (e) {
        console.error('[audit] write failed:', e && e.message ? e.message : e);
    }
}

/**
 * Extract request context (ip, user-agent, acting user id) from an Express req.
 * Safe to call before/after auth middleware (userId is null if not authenticated).
 */
function reqCtx(req) {
    if (!req) return { ip: null, userAgent: null, userId: null };
    const fwd = req.headers && req.headers['x-forwarded-for'];
    const ip = (fwd ? String(fwd).split(',')[0].trim() : null)
        || (req.socket && req.socket.remoteAddress)
        || (req.connection && req.connection.remoteAddress)
        || null;
    const userAgent = req.headers ? (req.headers['user-agent'] || null) : null;
    const u = req.user || {};
    const userId = u.userId != null ? u.userId : (u.usr_id != null ? u.usr_id : null);
    return { ip, userAgent, userId };
}

module.exports = { writeAudit, reqCtx };
