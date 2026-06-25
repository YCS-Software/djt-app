/**
 * Web Reports Model
 * Admin web console (djt-web) — revenue, energy and session reports by station.
 * Read-only SELECTs only against the live `*_lst_t` schema.
 */

const sqldb = require(appRoot + '/config/db.config');
const dbutil = require(appRoot + '/utils/db.utils');
const cntxtDtls = "reportsMdl";

/*****************************************************************************
* Function      : listMdl
* Description   : Revenue, energy and session totals aggregated by station.
******************************************************************************/
exports.listMdl = function() {
    const QRY_TO_EXEC = `SELECT s.sttn_id AS id, s.sttn_nm_tx AS station, s.cty_tx AS city, COUNT(se.sssn_id) AS sessions, COALESCE(SUM(se.enrgy_cnsmd_kwh),0) AS energyKwh, COALESCE(SUM(se.ttl_cst_amt),0) AS revenue FROM sttn_lst_t s LEFT JOIN sssn_lst_t se ON se.sttn_id=s.sttn_id AND se.sttus_cd='completed' GROUP BY s.sttn_id, s.sttn_nm_tx, s.cty_tx ORDER BY revenue DESC`;

    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, [], cntxtDtls);
};

/*****************************************************************************
* Function      : getByIdMdl
* Description   : Single station report by primary id (list select wrapped).
* Arguments     : data object with id
******************************************************************************/
exports.getByIdMdl = function(data) {
    const id = parseInt(data.id, 10) || 0;
    const QRY_TO_EXEC = `SELECT * FROM ( SELECT s.sttn_id AS id, s.sttn_nm_tx AS station, s.cty_tx AS city, COUNT(se.sssn_id) AS sessions, COALESCE(SUM(se.enrgy_cnsmd_kwh),0) AS energyKwh, COALESCE(SUM(se.ttl_cst_amt),0) AS revenue FROM sttn_lst_t s LEFT JOIN sssn_lst_t se ON se.sttn_id=s.sttn_id AND se.sttus_cd='completed' GROUP BY s.sttn_id, s.sttn_nm_tx, s.cty_tx ORDER BY revenue DESC ) q WHERE q.id = ?`;

    const PARAMS = [id];
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

/*****************************************************************************
* Report Builder — generate any of the admin report types with an optional
* date range + filter. Each definition is a read-only SELECT with column
* aliases; `dateCol` (if set) enables start/end date filtering and
* `filterField` (if set) enables the "Filter By" dropdown.
******************************************************************************/
const esc = (v) => String(v).replace(/'/g, "''");
const isDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '');

const REPORT_DEFS = {
    partners: {
        label: 'Partners',
        columns: [['name', 'Name'], ['email', 'Email'], ['phone', 'Phone'], ['stations', 'Stations'], ['status', 'Status']],
        dateCol: 'u.i_ts', filterField: null, filterOptions: [],
        build: (w) => `SELECT u.usr_id AS id, u.nm_tx AS name, u.eml_tx AS email, u.phn_nmbr_tx AS phone, (SELECT COUNT(*) FROM sttn_lst_t s WHERE s.ownr_usr_id=u.usr_id AND s.a_in=1) AS stations, CASE WHEN u.a_in=1 THEN 'Active' ELSE 'Inactive' END AS status FROM usr_lst_t u WHERE u.usr_typ_cd='owner' ${w} ORDER BY u.usr_id DESC`,
    },
    locations: {
        label: 'Locations',
        columns: [['name', 'Name'], ['code', 'Code'], ['city', 'City'], ['state', 'State'], ['totalChargers', 'Total Chargers'], ['pricePerKwh', 'Price/kWh'], ['status', 'Status']],
        dateCol: 's.i_ts', filterField: 's.aprvl_sttus_cd', filterOptions: ['active', 'pending', 'rejected'],
        build: (w) => `SELECT s.sttn_id AS id, s.sttn_nm_tx AS name, s.sttn_cd AS code, s.cty_tx AS city, s.stte_tx AS state, s.ttl_chrgrs_nbr AS totalChargers, s.prce_per_kwh_amt AS pricePerKwh, UPPER(COALESCE(NULLIF(s.aprvl_sttus_cd,''),'UNKNOWN')) AS status FROM sttn_lst_t s WHERE 1=1 ${w} ORDER BY s.sttn_id DESC`,
    },
    users: {
        label: 'Users',
        columns: [['name', 'Name'], ['email', 'Email'], ['phone', 'Phone'], ['role', 'Role'], ['status', 'Status']],
        dateCol: 'i_ts', filterField: 'usr_typ_cd', filterOptions: ['admin', 'owner'],
        build: (w) => `SELECT usr_id AS id, nm_tx AS name, eml_tx AS email, phn_nmbr_tx AS phone, usr_typ_cd AS role, CASE WHEN a_in=1 THEN 'Active' ELSE 'Inactive' END AS status FROM usr_lst_t WHERE usr_typ_cd IN ('admin','owner') ${w} ORDER BY usr_id DESC`,
    },
    drivers: {
        label: 'EV Drivers',
        columns: [['name', 'Name'], ['email', 'Email'], ['phone', 'Phone'], ['walletBalance', 'Wallet Balance'], ['status', 'Status']],
        dateCol: 'u.i_ts', filterField: null, filterOptions: [],
        build: (w) => `SELECT u.usr_id AS id, u.nm_tx AS name, u.eml_tx AS email, u.phn_nmbr_tx AS phone, COALESCE(w.blnce_amt,0) AS walletBalance, CASE WHEN u.a_in=1 THEN 'Active' ELSE 'Inactive' END AS status FROM usr_lst_t u LEFT JOIN wllt_lst_t w ON w.usr_id=u.usr_id AND w.a_in=1 WHERE u.usr_typ_cd='customer' ${w} ORDER BY u.usr_id DESC`,
    },
    transactions: {
        label: 'Transactions',
        columns: [['user', 'User'], ['type', 'Type'], ['category', 'Category'], ['amount', 'Amount'], ['status', 'Status'], ['createdAt', 'Date']],
        dateCol: 't.i_ts', filterField: 't.trxn_typ_cd', filterOptions: ['credit', 'debit', 'refund'],
        build: (w) => `SELECT t.trxn_id AS id, u.nm_tx AS user, t.trxn_typ_cd AS type, t.trxn_ctgry_cd AS category, t.amt AS amount, t.sttus_cd AS status, t.i_ts AS createdAt FROM trxn_lst_t t LEFT JOIN usr_lst_t u ON u.usr_id=t.usr_id WHERE 1=1 ${w} ORDER BY t.trxn_id DESC`,
    },
    disputes: {
        label: 'Disputes',
        columns: [['user', 'User'], ['subject', 'Subject'], ['status', 'Status'], ['createdAt', 'Date']],
        dateCol: null, filterField: null, filterOptions: [],
        build: () => null,
    },
    stations: {
        label: 'Charging Station',
        columns: [['name', 'Name'], ['serial', 'Serial No'], ['ocppId', 'OCPP ID'], ['type', 'Type'], ['power', 'Power'], ['connectors', 'Connectors'], ['station', 'Station'], ['status', 'Status']],
        dateCol: 'm.i_ts', filterField: 'm.sttus_cd', filterOptions: ['available', 'unavailable', 'faulted', 'charging'],
        build: (w) => `SELECT m.mchn_id AS id, m.mchn_nm_tx AS name, m.mchn_srl_no_tx AS serial, m.ocpp_id_tx AS ocppId, m.mchn_typ_cd AS type, m.max_pwr_tx AS power, m.ttl_cnntrs_nbr AS connectors, s.sttn_nm_tx AS station, m.sttus_cd AS status FROM mchn_lst_t m LEFT JOIN sttn_lst_t s ON s.sttn_id=m.sttn_id WHERE 1=1 ${w} ORDER BY m.mchn_id DESC`,
    },
    sessions: {
        label: 'Sessions',
        columns: [['code', 'Session Code'], ['user', 'User'], ['station', 'Station'], ['energy', 'Energy (kWh)'], ['cost', 'Cost'], ['status', 'Status'], ['startedAt', 'Started']],
        dateCol: 's.strt_ts', filterField: 's.sttus_cd', filterOptions: ['completed', 'active', 'failed'],
        build: (w) => `SELECT s.sssn_id AS id, s.sssn_cd AS code, u.nm_tx AS user, st.sttn_nm_tx AS station, s.enrgy_cnsmd_kwh AS energy, s.ttl_cst_amt AS cost, s.sttus_cd AS status, s.strt_ts AS startedAt FROM sssn_lst_t s LEFT JOIN usr_lst_t u ON u.usr_id=s.usr_id LEFT JOIN sttn_lst_t st ON st.sttn_id=s.sttn_id WHERE 1=1 ${w} ORDER BY s.sssn_id DESC`,
    },
};

// Ordered metadata for the report builder UI (left rail + column headers).
exports.reportMeta = function() {
    return Object.keys(REPORT_DEFS).map((type) => {
        const d = REPORT_DEFS[type];
        return {
            type,
            label: d.label,
            columns: d.columns.map(([field, headerName]) => ({ field, headerName })),
            hasDateRange: !!d.dateCol,
            filterOptions: d.filterOptions || [],
        };
    });
};

exports.columnsFor = function(type) {
    const d = REPORT_DEFS[type];
    return d ? d.columns.map(([field, headerName]) => ({ field, headerName })) : [];
};

// Build + run a report query. Returns Promise<rows[]>.
exports.generateReportMdl = function(data) {
    const def = REPORT_DEFS[data.type];
    if (!def) return Promise.reject({ err_message: 'Unknown report type' });
    if (!def.build) return Promise.resolve([]);

    let w = '';
    const PARAMS = [];
    // def.dateCol / def.filterField are identifiers from the static REPORT_DEFS
    // (never user input) so they stay inline; user values are bound via `?`.
    if (def.dateCol && isDate(data.startDate) && isDate(data.endDate)) {
        w += ` AND DATE(${def.dateCol}) BETWEEN ? AND ?`;
        PARAMS.push(data.startDate, data.endDate);
    }
    if (def.filterField && data.filter) {
        w += ` AND ${def.filterField} = ?`;
        PARAMS.push(String(data.filter));
    }

    const sql = def.build(w);
    if (!sql) return Promise.resolve([]);
    return dbutil.execQuery(sqldb.MySQLConPool, sql, PARAMS, cntxtDtls);
};
