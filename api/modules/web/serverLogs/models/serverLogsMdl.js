/**
 * Web serverLogs Model (admin web console — djt-web).
 * CSMS / OCPP message logs from the live `ocpp_msg_log_t` table (the OCPP
 * WebSocket request/response audit trail). Read-only, filterable. Degrades to
 * an empty set if the table is absent in this environment.
 */
const sqldb = require(appRoot + '/config/db.config');
const dbutil = require(appRoot + '/utils/db.utils');
const cntxtDtls = "serverLogsMdl";

const isDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '');

exports.listMdl = function (filters) {
    filters = filters || {};
    const where = [];
    const params = [];
    if (filters.ocppId)      { where.push('l.ocpp_id_tx = ?');   params.push(String(filters.ocppId)); }
    if (filters.direction)   { where.push('l.drctn_cd = ?');     params.push(String(filters.direction)); }
    if (filters.messageType) { where.push('l.msg_typ_cd = ?');   params.push(String(filters.messageType)); }
    if (filters.action)      { where.push('l.actn_tx = ?');      params.push(String(filters.action)); }
    if (isDate(filters.startDate) && isDate(filters.endDate)) {
        where.push('DATE(l.i_ts) BETWEEN ? AND ?');
        params.push(filters.startDate, filters.endDate);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const QRY = `SELECT l.msg_log_id AS id,
                        l.ocpp_id_tx AS ocppId,
                        st.sttn_nm_tx AS stationName,
                        l.drctn_cd AS direction,
                        l.msg_typ_cd AS messageType,
                        l.actn_tx AS action,
                        l.ocpp_msg_id_tx AS messageId,
                        l.payld_json AS payload,
                        l.err_cd_tx AS errorCode,
                        l.err_desc_tx AS errorDesc,
                        l.ltncy_ms_nbr AS latencyMs,
                        l.rmt_addr_tx AS remoteAddr,
                        l.i_ts AS timestamp
                 FROM ocpp_msg_log_t l
                 LEFT JOIN sttn_lst_t st ON st.sttn_id = l.sttn_id
                 ${whereSql}
                 ORDER BY l.msg_log_id DESC
                 LIMIT 500`;
    return dbutil.execQuery(sqldb.MySQLConPool, QRY, params, cntxtDtls).catch(() => []);
};
