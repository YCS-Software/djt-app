/**
 * Web Sessions Model
 * Admin web console (djt-web) — all charging sessions (history + live).
 * Read-only SELECTs only against the live `*_lst_t` schema.
 */

const sqldb = require(appRoot + '/config/db.config');
const dbutil = require(appRoot + '/utils/db.utils');
const cntxtDtls = "sessionsMdl";

// Shared projection: session joined to station + member for display.
const SELECT = `SELECT
        s.sssn_id            AS id,
        s.sssn_cd            AS sessionCode,
        s.ocpp_txn_id_tx     AS transactionId,
        s.sttus_cd           AS status,
        s.pymnt_sttus_cd     AS paymentStatus,
        st.sttn_nm_tx        AS stationName,
        u.nm_tx              AS member,
        s.enrgy_cnsmd_kwh    AS energy,
        s.prce_per_kwh_amt   AS pricePerKwh,
        s.ttl_cst_amt        AS cost,
        s.durn_mnts_nbr      AS durationMins,
        s.prgrss_pct         AS progress,
        s.strt_ts            AS startTime,
        s.end_ts             AS endTime,
        s.i_ts               AS createdAt
    FROM sssn_lst_t s
    LEFT JOIN sttn_lst_t st ON st.sttn_id = s.sttn_id
    LEFT JOIN usr_lst_t  u  ON u.usr_id   = s.usr_id`;

/*****************************************************************************
* Function      : listMdl
* Description   : All charging sessions, newest first (capped for the table).
******************************************************************************/
exports.listMdl = function() {
    const QRY_TO_EXEC = `${SELECT} ORDER BY s.sssn_id DESC LIMIT 500`;
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};

/*****************************************************************************
* Function      : getByIdMdl
* Description   : Single session by primary id.
* Arguments     : data object with id
******************************************************************************/
exports.getByIdMdl = function(data) {
    const id = parseInt(data.id, 10) || 0;
    const QRY_TO_EXEC = `SELECT * FROM ( ${SELECT} ORDER BY s.sssn_id DESC ) q WHERE q.id = ${id}`;
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};

/*****************************************************************************
* Function      : summaryMdl
* Description   : Charging totals across completed sessions — consumption,
*                 amount (with taxes), energy price (Σ kWh × price) — used by
*                 the Sessions dashboard cards. Tax is derived in the controller.
******************************************************************************/
exports.summaryMdl = function() {
    const QRY = `SELECT COALESCE(SUM(enrgy_cnsmd_kwh), 0) AS totalConsumption,
                        COALESCE(SUM(ttl_cst_amt), 0) AS totalAmount,
                        COALESCE(SUM(enrgy_cnsmd_kwh * prce_per_kwh_amt), 0) AS totalEnergyPrice
                 FROM sssn_lst_t
                 WHERE sttus_cd = 'completed'`;
    return dbutil.execQuery(sqldb.MySQLConPool, QRY, [], cntxtDtls);
};

/*****************************************************************************
* Function      : sessionLogsMdl
* Description   : CSMS / OCPP server logs for one session — messages exchanged
*                 with the session's charge point around the session window.
******************************************************************************/
exports.sessionLogsMdl = function(data) {
    const id = parseInt(data.id, 10) || 0;
    const QRY = `SELECT l.msg_log_id AS id, l.ocpp_id_tx AS ocppId, l.drctn_cd AS direction,
                        l.msg_typ_cd AS messageType, l.actn_tx AS action, l.ocpp_msg_id_tx AS messageId,
                        l.payld_json AS payload, l.err_cd_tx AS errorCode, l.err_desc_tx AS errorDesc,
                        l.ltncy_ms_nbr AS latencyMs, l.i_ts AS timestamp
                 FROM ocpp_msg_log_t l
                 JOIN sssn_lst_t s ON s.sssn_id = ?
                 WHERE l.sttn_id = s.sttn_id
                   AND (s.strt_ts IS NULL OR l.i_ts >= DATE_SUB(s.strt_ts, INTERVAL 5 MINUTE))
                   AND (s.end_ts IS NULL OR l.i_ts <= DATE_ADD(s.end_ts, INTERVAL 5 MINUTE))
                 ORDER BY l.msg_log_id DESC
                 LIMIT 300`;
    return dbutil.execQuery(sqldb.MySQLConPool, QRY, [id], cntxtDtls).catch(() => []);
};
