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
* Arguments     : data { code, providerTemplateId, dltTemplateId, name, body, senderId, provider, description }
******************************************************************************/
exports.insertTemplateMdl = function (data) {
    const QRY = `INSERT INTO sms_tmplt_lst_t
        (tmplt_cd, prvdr_tmplt_id_tx, dlt_tmplt_id_tx, tmplt_nm_tx, body_tx, sndr_id_tx, prvdr_cd, dscrptn_tx, a_in)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
        ON DUPLICATE KEY UPDATE
            prvdr_tmplt_id_tx = VALUES(prvdr_tmplt_id_tx),
            dlt_tmplt_id_tx = COALESCE(VALUES(dlt_tmplt_id_tx), dlt_tmplt_id_tx),
            tmplt_nm_tx = VALUES(tmplt_nm_tx),
            body_tx     = VALUES(body_tx),
            sndr_id_tx  = VALUES(sndr_id_tx),
            dscrptn_tx  = VALUES(dscrptn_tx),
            a_in        = 1`;
    return pool.query(QRY, [
        data.code,
        data.providerTemplateId,
        data.dltTemplateId || null,
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

/* ======================================================================
 * Database-driven messaging (templates by code and their variables)
 * ====================================================================== */

/*****************************************************************************
* Function      : getTemplateByCodeMdl
* Description   : Fetch an active template by its code (e.g. 'DJT_OTP')
******************************************************************************/
exports.getTemplateByCodeMdl = function (code) {
    const QRY = `SELECT * FROM sms_tmplt_lst_t
        WHERE tmplt_cd = ? AND a_in = 1
        LIMIT 1`;
    return pool.query(QRY, [String(code)]);
};

/*****************************************************************************
* Function      : getTemplateVarsMdl
* Description   : Active variable definitions for one template
******************************************************************************/
exports.getTemplateVarsMdl = function (templateId) {
    const QRY = `SELECT var_nm_tx, src_ky_tx, frmt_cd, dflt_vl_tx, mx_lngth_nbr
        FROM sms_tmplt_var_lst_t
        WHERE tmplt_id = ? AND a_in = 1
        ORDER BY var_id`;
    return pool.query(QRY, [templateId]);
};

/*****************************************************************************
* Function      : getUserContactMdl
* Description   : Name + mobile of a user, used to address messages
******************************************************************************/
exports.getUserContactMdl = function (userId) {
    const QRY = `SELECT usr_id, nm_tx, phn_nmbr_tx FROM usr_lst_t WHERE usr_id = ? LIMIT 1`;
    return pool.query(QRY, [userId]);
};

/*****************************************************************************
* Function      : getSetupSnapshotMdl
* Description   : Every template and variable row (active or not), for the
*                 setup checker
******************************************************************************/
exports.getSetupSnapshotMdl = async function () {
    const templates = await pool.query(
        `SELECT tmplt_id, tmplt_cd, tmplt_nm_tx, prvdr_tmplt_id_tx, body_tx, sndr_id_tx, a_in
           FROM sms_tmplt_lst_t ORDER BY tmplt_id`);
    const variables = await pool.query(
        `SELECT var_id, tmplt_id, var_nm_tx, src_ky_tx, frmt_cd, dflt_vl_tx, mx_lngth_nbr, a_in
           FROM sms_tmplt_var_lst_t ORDER BY tmplt_id, var_id`);
    return { templates, variables };
};
