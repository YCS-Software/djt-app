/**
 * Web auditLogs Model (admin web console — djt-web).
 * Reads the application audit trail from audt_lst_t (written by auditUtil across
 * auth, sessions, owner/admin CRUD, and by the ledger for money movements).
 * All values are bound; LIMIT/OFFSET are validated integers.
 */
const sqldb = require(appRoot + '/config/db.config');
const pool = sqldb.pool;
const cntxtDtls = "auditLogsMdl";

exports.listMdl = function (filters = {}) {
    const where = [];
    const params = [];
    if (filters.userId)     { where.push('a.usr_id = ?');       params.push(parseInt(filters.userId, 10) || 0); }
    if (filters.action)     { where.push('a.actn_cd = ?');      params.push(String(filters.action)); }
    if (filters.entityType) { where.push('a.entty_typ_cd = ?'); params.push(String(filters.entityType)); }
    if (filters.entityId)   { where.push('a.entty_id = ?');     params.push(parseInt(filters.entityId, 10) || 0); }
    if (filters.category)   { where.push('am.ctgry_cd = ?');    params.push(String(filters.category)); }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const limit = Number.isFinite(+filters.limit) && +filters.limit ? Math.min(500, Math.max(1, parseInt(filters.limit, 10))) : 100;
    const offset = Number.isFinite(+filters.offset) && +filters.offset ? Math.max(0, parseInt(filters.offset, 10)) : 0;

    const QRY = `
        SELECT a.log_id        AS id,
               a.usr_id        AS userId,
               u.nm_tx         AS userName,
               a.actn_cd       AS action,
               am.actn_lbl_tx  AS actionLabel,
               am.ctgry_cd     AS actionCategory,
               a.entty_typ_cd  AS entityType,
               a.entty_id      AS entityId,
               a.old_vl_json   AS oldValue,
               a.nw_vl_json    AS newValue,
               a.ip_addr_tx    AS ipAddress,
               a.usr_agnt_tx   AS userAgent,
               a.i_ts          AS createdAt
          FROM audt_lst_t a
          LEFT JOIN usr_lst_t u  ON u.usr_id  = a.usr_id
          LEFT JOIN actn_lst_t am ON am.actn_cd = a.actn_cd
          ${whereSql}
          ORDER BY a.log_id DESC
          LIMIT ${limit} OFFSET ${offset}`;

    return pool.execute(QRY, params).then(([rows]) => rows).catch((e) => {
        console.error(`[${cntxtDtls}] listMdl`, e && e.message ? e.message : e);
        return [];
    });
};

// Action master (actn_lst_t) for filter dropdowns.
exports.listActionsMdl = function () {
    return pool.execute(
        `SELECT actn_cd AS code, actn_lbl_tx AS label, ctgry_cd AS category, dscrptn_tx AS description
           FROM actn_lst_t WHERE a_in = 1 ORDER BY ctgry_cd, actn_cd`
    ).then(([rows]) => rows).catch((e) => {
        console.error(`[${cntxtDtls}] listActionsMdl`, e && e.message ? e.message : e);
        return [];
    });
};
