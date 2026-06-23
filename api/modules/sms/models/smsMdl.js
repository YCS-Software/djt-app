/**
 * SMS Model
 * Database operations for SMS templates (sms_tmplt_lst_t) and the
 * per-message audit log (sms_msg_log_t).
 *
 * Uses parameterized queries (mysql2 `?` placeholders) throughout, since
 * message variable values can originate from end-user input.
 */

const sqldb = require(appRoot + '/config/db.config');
const pool = sqldb.MySQLConPool;

/*****************************************************************************
* Function      : getConfigMdl
* Description   : Fetch all active SMS gateway settings (key/value)
******************************************************************************/
exports.getConfigMdl = function () {
    const QRY = `SELECT cnfg_ky_tx, cnfg_vl_tx FROM sms_cnfg_t WHERE a_in = 1`;
    return pool.query(QRY);
};

/*****************************************************************************
* Function      : upsertConfigMdl
* Description   : Insert or update a single config key/value
* Arguments     : data { key, value, description? }
******************************************************************************/
exports.upsertConfigMdl = function (data) {
    const QRY = `INSERT INTO sms_cnfg_t (cnfg_ky_tx, cnfg_vl_tx, dscrptn_tx, a_in)
        VALUES (?, ?, ?, 1)
        ON DUPLICATE KEY UPDATE
            cnfg_vl_tx = VALUES(cnfg_vl_tx),
            dscrptn_tx = COALESCE(VALUES(dscrptn_tx), dscrptn_tx),
            a_in = 1`;
    return pool.query(QRY, [data.key, data.value, data.description || null]);
};

/*****************************************************************************
* Function      : getTemplateByProviderIdMdl
* Description   : Fetch an active template by its provider (MSG91) template id
* Arguments     : providerTemplateId (string)
******************************************************************************/
exports.getTemplateByProviderIdMdl = function (providerTemplateId) {
    const QRY = `SELECT * FROM sms_tmplt_lst_t
        WHERE prvdr_tmplt_id_tx = ? AND a_in = 1
        LIMIT 1`;
    return pool.query(QRY, [providerTemplateId]);
};

/*****************************************************************************
* Function      : getTemplateByIdMdl
* Description   : Fetch an active template by its internal numeric id
* Arguments     : templateId (number)
******************************************************************************/
exports.getTemplateByIdMdl = function (templateId) {
    const QRY = `SELECT * FROM sms_tmplt_lst_t
        WHERE tmplt_id = ? AND a_in = 1
        LIMIT 1`;
    return pool.query(QRY, [templateId]);
};

/*****************************************************************************
* Function      : listTemplatesMdl
* Description   : List all active templates
******************************************************************************/
exports.listTemplatesMdl = function () {
    const QRY = `SELECT * FROM sms_tmplt_lst_t WHERE a_in = 1 ORDER BY tmplt_id DESC`;
    return pool.query(QRY);
};

/*****************************************************************************
* Function      : insertTemplateMdl
* Description   : Insert (or upsert) a template by provider template id
* Arguments     : data { providerTemplateId, name, body, senderId, provider, description }
******************************************************************************/
exports.insertTemplateMdl = function (data) {
    const QRY = `INSERT INTO sms_tmplt_lst_t
        (prvdr_tmplt_id_tx, tmplt_nm_tx, body_tx, sndr_id_tx, prvdr_cd, dscrptn_tx, a_in)
        VALUES (?, ?, ?, ?, ?, ?, 1)
        ON DUPLICATE KEY UPDATE
            tmplt_nm_tx = VALUES(tmplt_nm_tx),
            body_tx     = VALUES(body_tx),
            sndr_id_tx  = VALUES(sndr_id_tx),
            dscrptn_tx  = VALUES(dscrptn_tx),
            a_in        = 1`;
    return pool.query(QRY, [
        data.providerTemplateId,
        data.name || null,
        data.body,
        data.senderId || null,
        data.provider || 'MSG91',
        data.description || null,
    ]);
};

/*****************************************************************************
* Function      : insertMsgLogMdl
* Description   : Create an audit-log row for a message (initial status PENDING)
* Arguments     : data { templateId, providerTemplateId, mobile, variables,
*                        renderedBody, senderId, status, usrId }
* Returns       : ResultSetHeader (use .insertId)
******************************************************************************/
exports.insertMsgLogMdl = function (data) {
    const QRY = `INSERT INTO sms_msg_log_t
        (tmplt_id, prvdr_tmplt_id_tx, mobile_tx, vars_tx, rndrd_body_tx,
         sndr_id_tx, stts_cd, usr_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    return pool.query(QRY, [
        data.templateId || null,
        data.providerTemplateId || null,
        data.mobile,
        data.variables ? JSON.stringify(data.variables) : null,
        data.renderedBody || null,
        data.senderId || null,
        data.status || 'PENDING',
        data.usrId || null,
    ]);
};

/*****************************************************************************
* Function      : updateMsgLogStatusMdl
* Description   : Update the outcome of a message after the send attempt
* Arguments     : data { msgId, status, providerMsgId, providerResponse, error, isMock }
******************************************************************************/
exports.updateMsgLogStatusMdl = function (data) {
    const QRY = `UPDATE sms_msg_log_t SET
            stts_cd         = ?,
            prvdr_msg_id_tx = ?,
            prvdr_rspns_tx  = ?,
            err_tx          = ?,
            is_mock_in      = ?
        WHERE msg_id = ?`;
    return pool.query(QRY, [
        data.status,
        data.providerMsgId || null,
        data.providerResponse ? JSON.stringify(data.providerResponse) : null,
        data.error || null,
        data.isMock ? 1 : 0,
        data.msgId,
    ]);
};

/*****************************************************************************
* Function      : getMsgLogsMdl
* Description   : Fetch recent message logs, optionally filtered by mobile
* Arguments     : data { mobile?, limit? }
******************************************************************************/
exports.getMsgLogsMdl = function (data = {}) {
    const limit = Math.min(parseInt(data.limit, 10) || 50, 200);
    if (data.mobile) {
        const QRY = `SELECT * FROM sms_msg_log_t
            WHERE mobile_tx = ? ORDER BY msg_id DESC LIMIT ${limit}`;
        return pool.query(QRY, [data.mobile]);
    }
    const QRY = `SELECT * FROM sms_msg_log_t ORDER BY msg_id DESC LIMIT ${limit}`;
    return pool.query(QRY);
};
