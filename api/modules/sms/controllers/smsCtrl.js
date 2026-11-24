/**
 * SMS Controller (admin)
 * Send / preview a template by hand, check the template rows, manage templates,
 * and read the message log. All sending goes through utils/messageService.
 */

const std = require(appRoot + '/utils/standardMessages');
const df = require(appRoot + '/utils/dateFormatUtil');
const smsMdl = require('../models/smsMdl');
const messages = require(appRoot + '/utils/messageService');
const cntxtDtls = 'smsCtrl';

function badRequest(res, message, data) {
    return res.status(std.message['BAD_REQUEST'].code).json({
        status: std.message['BAD_REQUEST'].code,
        message: message,
        data: data || null,
    });
}

/*****************************************************************************
* Function      : sendMessage
* Description   : Send one template by hand. Body:
*                 { template: 'DJT_OTP', mobile: '9876543210', data: { otp: '4821' } }
*                 `template` is the tmplt_cd in sms_tmplt_lst_t.
******************************************************************************/
exports.sendMessage = function (req, res) {
    const fnm = 'sendMessage';
    const body = req.body || {};
    if (!body.template) return badRequest(res, 'template (the template code) is required');

    messages.send(String(body.template), body.mobile, body.data || {})
        .then(function (result) {
            if (!result.success) return badRequest(res, result.error || 'Failed to send message', result);
            return df.formatSucessRes(req, res, result, cntxtDtls, fnm, {});
        })
        .catch(function (error) {
            return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
        });
};

/*****************************************************************************
* Function      : preview
* Description   : Show the final SMS text with real values filled in, without
*                 sending or logging anything. Same body as sendMessage.
******************************************************************************/
exports.preview = function (req, res) {
    const fnm = 'preview';
    const body = req.body || {};
    if (!body.template) return badRequest(res, 'template (the template code) is required');

    messages.preview(String(body.template), body.mobile, body.data || {})
        .then(function (result) {
            return df.formatSucessRes(req, res, result, cntxtDtls, fnm, {
                message: result.error || 'Preview only — nothing was sent',
            });
        })
        .catch(function (error) {
            return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
        });
};

/*****************************************************************************
* Function      : checkSetup
* Description   : Report mistakes in the template / variable rows.
******************************************************************************/
exports.checkSetup = function (req, res) {
    const fnm = 'checkSetup';
    messages.checkSetup()
        .then(function (result) {
            return df.formatSucessRes(req, res, result, cntxtDtls, fnm, {
                message: result.ok ? 'No errors found' : result.errors.length + ' error(s) found',
            });
        })
        .catch(function (error) {
            return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
        });
};

/*****************************************************************************
* Function      : addTemplate
* Description   : Insert/update a template. Body:
*                 { code, providerTemplateId, body, name?, senderId?, dltTemplateId?, description? }
*                 Variable rows (sms_tmplt_var_lst_t) are inserted separately.
******************************************************************************/
exports.addTemplate = function (req, res) {
    const fnm = 'addTemplate';
    const data = req.body.data ? req.body.data : req.body;
    const { code, providerTemplateId, dltTemplateId, name, body, senderId, description } = data;

    if (!code || !providerTemplateId || !body) {
        return badRequest(res, 'code, providerTemplateId and body are required');
    }

    smsMdl.insertTemplateMdl({ code: String(code).trim(), providerTemplateId, dltTemplateId, name, body, senderId, description })
        .then(function (result) {
            return df.formatSucessRes(req, res, {
                templateId: result.insertId || null,
                code: String(code).trim(),
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
* Description   : Active templates, plus the template codes the application
*                 already sends and the values it passes for each.
******************************************************************************/
exports.listTemplates = function (req, res) {
    const fnm = 'listTemplates';
    smsMdl.listTemplatesMdl()
        .then(function (rows) {
            return df.formatSucessRes(req, res, {
                templates: rows,
                sent_by_application: messages.TEMPLATES,
                common_data_keys: messages.COMMON_KEYS,
            }, cntxtDtls, fnm, {});
        })
        .catch(function (error) {
            console.error('[listTemplates] Error:', error);
            return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
        });
};

/*****************************************************************************
* Function      : getLogs
* Description   : View message audit log. Query: ?mobile=...&limit=...
******************************************************************************/
exports.getLogs = function (req, res) {
    const fnm = 'getLogs';
    const mobile = req.query.mobile ? messages.normalizeMobile(req.query.mobile) : null;

    smsMdl.getMsgLogsMdl({ mobile, limit: req.query.limit })
        .then(function (rows) {
            return df.formatSucessRes(req, res, rows, cntxtDtls, fnm, {});
        })
        .catch(function (error) {
            console.error('[getLogs] Error:', error);
            return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
        });
};
