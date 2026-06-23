/**
 * SMS Controller
 * HTTP endpoints for sending template-based SMS, managing templates, and
 * viewing the message audit log.
 */

const std = require(appRoot + '/utils/standardMessages');
const df = require(appRoot + '/utils/dateFormatUtil');
const sms = require(appRoot + '/utils/smsUtil');
const smsMdl = require('../models/smsMdl');
const cntxtDtls = 'smsCtrl';

/*****************************************************************************
* Function      : sendMessage
* Description   : Send a templated SMS. Body:
*                 { template, mobile, variables: { var1: '1234' }, senderId? }
******************************************************************************/
exports.sendMessage = function (req, res) {
    const fnm = 'sendMessage';
    const data = req.body.data ? req.body.data : req.body;
    const { template, mobile, variables, senderId, usrId } = data;

    if (!template || !mobile) {
        return res.status(std.message['BAD_REQUEST'].code).json({
            status: std.message['BAD_REQUEST'].code,
            message: 'template and mobile are required',
            data: null,
        });
    }

    sms.sendTemplateMessage({ template, mobile, variables, senderId, usrId })
        .then(function (result) {
            if (!result.success) {
                return res.status(std.message['BAD_REQUEST'].code).json({
                    status: std.message['BAD_REQUEST'].code,
                    message: result.error || 'Failed to send message',
                    data: result,
                });
            }
            return df.formatSucessRes(req, res, result, cntxtDtls, fnm, {});
        })
        .catch(function (error) {
            console.error('[sendMessage] Error:', error);
            return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
        });
};

/*****************************************************************************
* Function      : addTemplate
* Description   : Insert/upsert a template. Body:
*                 { providerTemplateId, name, body, senderId?, description? }
******************************************************************************/
exports.addTemplate = function (req, res) {
    const fnm = 'addTemplate';
    const data = req.body.data ? req.body.data : req.body;
    const { providerTemplateId, name, body, senderId, description } = data;

    if (!providerTemplateId || !body) {
        return res.status(std.message['BAD_REQUEST'].code).json({
            status: std.message['BAD_REQUEST'].code,
            message: 'providerTemplateId and body are required',
            data: null,
        });
    }

    smsMdl.insertTemplateMdl({ providerTemplateId, name, body, senderId, description })
        .then(function (result) {
            return df.formatSucessRes(req, res, {
                templateId: result.insertId || null,
                providerTemplateId,
            }, cntxtDtls, fnm, {});
        })
        .catch(function (error) {
            console.error('[addTemplate] Error:', error);
            return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
        });
};

/*****************************************************************************
* Function      : listTemplates
* Description   : List active templates
******************************************************************************/
exports.listTemplates = function (req, res) {
    const fnm = 'listTemplates';
    smsMdl.listTemplatesMdl()
        .then(function (rows) {
            return df.formatSucessRes(req, res, rows, cntxtDtls, fnm, {});
        })
        .catch(function (error) {
            console.error('[listTemplates] Error:', error);
            return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
        });
};

/*****************************************************************************
* Function      : getConfig
* Description   : Return the DB-backed gateway settings (sender id, country code,
*                 default OTP template id)
******************************************************************************/
exports.getConfig = function (req, res) {
    const fnm = 'getConfig';
    sms.clearSettingsCache();
    sms.getSmsSettings()
        .then(function (settings) {
            return df.formatSucessRes(req, res, settings, cntxtDtls, fnm, {});
        })
        .catch(function (error) {
            console.error('[getConfig] Error:', error);
            return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
        });
};

/*****************************************************************************
* Function      : updateConfig
* Description   : Upsert a gateway setting. Body: { key, value, description? }
*                 Keys: DEFAULT_SENDER_ID | DEFAULT_COUNTRY_CODE | DEFAULT_OTP_TEMPLATE_ID
******************************************************************************/
exports.updateConfig = function (req, res) {
    const fnm = 'updateConfig';
    const data = req.body.data ? req.body.data : req.body;
    const { key, value, description } = data;

    if (!key) {
        return res.status(std.message['BAD_REQUEST'].code).json({
            status: std.message['BAD_REQUEST'].code,
            message: 'key is required',
            data: null,
        });
    }

    smsMdl.upsertConfigMdl({ key, value, description })
        .then(function () {
            sms.clearSettingsCache(); // pick up the new value on next send
            return df.formatSucessRes(req, res, { key, value }, cntxtDtls, fnm, {});
        })
        .catch(function (error) {
            console.error('[updateConfig] Error:', error);
            return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
        });
};

/*****************************************************************************
* Function      : getLogs
* Description   : View message audit log. Query: ?mobile=...&limit=...
******************************************************************************/
exports.getLogs = function (req, res) {
    const fnm = 'getLogs';
    const mobile = req.query.mobile ? sms.normalizeMobile(req.query.mobile) : null;

    smsMdl.getMsgLogsMdl({ mobile, limit: req.query.limit })
        .then(function (rows) {
            return df.formatSucessRes(req, res, rows, cntxtDtls, fnm, {});
        })
        .catch(function (error) {
            console.error('[getLogs] Error:', error);
            return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
        });
};
