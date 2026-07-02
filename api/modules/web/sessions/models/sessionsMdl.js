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
