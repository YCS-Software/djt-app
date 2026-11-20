const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const std = require(appRoot + '/utils/standardMessages');
const config = require(appRoot + '/config/config');
const df = require(appRoot + '/utils/dateFormatUtil');
const authAppMdl = require('../models/authAppMdl');
const audit = require(appRoot + '/utils/auditUtil');
const sms = require(appRoot + '/utils/smsUtil');
const cntxtDtls = "authAppCtrl";

// JWT secret/expiry used for the web admin email+password flow.
// Must match accessCtrl.verifyToken (process.env.JWT_SECRET).
const JWT_SECRET = process.env.JWT_SECRET || config.jwt.secret;
const ACCESS_EXPIRES_IN = config.jwt.expiresIn || '7d';
const REFRESH_EXPIRES_IN = '60d';

// Shape the user object the way the admin web console (authSlice) expects.
const toAdminUser = (u) => ({
  id: u.usr_id,
  email: u.eml_tx,
  name: u.nm_tx,
  role: u.usr_typ_cd
});

// Generate a random 4-digit OTP (cryptographically random, 1000-9999)
const generateOTP = () => {
  return String(crypto.randomInt(1000, 10000));
};

// Optional fixed-OTP test logins (app-store reviewers, internal testers).
// Both must be set in .env to take effect, e.g.
//   OTP_TEST_NUMBERS=9000000001,9000000002
//   OTP_TEST_CODE=4321
// Numbers on the list get OTP_TEST_CODE and no SMS is sent to them.
const OTP_TEST_NUMBERS = String(process.env.OTP_TEST_NUMBERS || '')
  .split(',').map((s) => s.trim()).filter(Boolean);
const OTP_TEST_CODE = /^\d{4}$/.test(String(process.env.OTP_TEST_CODE || '')) ? String(process.env.OTP_TEST_CODE) : null;
const isTestNumber = (phone) => !!OTP_TEST_CODE && OTP_TEST_NUMBERS.indexOf(String(phone)) !== -1;

/**
 * Create an OTP for `phone`, store it, and deliver it by SMS (MSG91).
 * Resolves { otpId, devOtp } on success. Rejects with a user-facing error
 * (err_status 502) when the SMS could not be handed to the gateway, so the
 * app never tells the user "OTP sent" for a message that will not arrive.
 * `devOtp` is only set when the SMS gateway is in mock mode (no auth key).
 */
function issueOtp(phone, usrId) {
    const expiryMinutes = config.otp.expiryMinutes || 5;
    const testLogin = isTestNumber(phone);
    const otp = testLogin ? OTP_TEST_CODE : generateOTP();

    return authAppMdl.storeOTPMdl({ phoneNumber: phone, otp: otp, expiryMinutes: expiryMinutes })
        .then(function(otpResults) {
            const otpId = otpResults.insertId;
            if (testLogin) {
                console.log(`[otp] test number ******${String(phone).slice(-4)} — fixed OTP, no SMS sent`);
                return { otpId: otpId, devOtp: undefined };
            }
            return sms.sendOTP(phone, otp, { usrId: usrId || undefined })
                .then(function(result) {
                    if (!result || !result.success) {
                        console.error(`[otp] SMS send failed for ******${String(phone).slice(-4)}:`, result && result.error);
                        throw { err_status: 502, err_message: 'We could not send the OTP right now. Please try again in a moment.' };
                    }
                    if (result.mock) {
                        // No MSG91 key configured (local dev): surface the OTP so login still works.
                        console.log(`\n📱 [MOCK SMS] OTP for ${phone}: ${otp} (expires in ${expiryMinutes} min)\n`);
                    }
                    return { otpId: otpId, devOtp: result.mock ? otp : undefined };
                });
        });
}

/*****************************************************************************
* Function      : sendOTP
* Description   : Send OTP to mobile number
* Arguments     : req, res
******************************************************************************/
exports.sendOTP = function(req, res) {
    let data = req.body.data ? req.body.data : req.body;
    var fnm = "sendOTP";
    
    const { phonenumber } = data;
    
    if (!phonenumber || phonenumber.length !== 10) {
        return res.status(std.message["BAD_REQUEST"].code).json({
            status: std.message["BAD_REQUEST"].code,
            message: 'Please provide a valid 10-digit mobile number',
            data: null
        });
    }
    
    // Check if user exists first
    authAppMdl.findUserByPhoneMdl({ phoneNumber: phonenumber })
        .then(function(userResults) {
            console.log(userResults, 'findUserByPhoneMdl results');
            const user = userResults && userResults.length > 0 ? userResults[0] : null;
            
            // Check if user is registered
            if (!user) {
                return res.status(404).json({
                    status: 404,
                    message: 'User not registered. Please signup first.',
                    data: null
                });
            }
            
            // Store the OTP and send it by SMS
            return issueOtp(phonenumber, user.usr_id).then(function(issued) {
                const ctx = audit.reqCtx(req);
                audit.writeAudit({
                    userId: user.usr_id,
                    action: 'otp_sent',
                    entityType: 'user',
                    entityId: user.usr_id,
                    newVal: { phone: '******' + phonenumber.slice(-4), otpID: issued.otpId },
                    ip: ctx.ip,
                    userAgent: ctx.userAgent
                });

                return df.formatSucessRes(req, res, {
                    otpID: issued.otpId,
                    usr_id: user.usr_id,
                    status: 'sent',
                    user_message: 'OTP has been sent to your mobile number',
                    show_fallback_message: false,
                    dev_otp: issued.devOtp
                }, cntxtDtls, fnm, {});
            });
        })
        .catch(function(error) {
            console.error('[sendOTP] Error:', error);
            return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
        });
};

/*****************************************************************************
* Function      : sendSignupOTP
* Description   : Send OTP for signup (allows non-registered users)
* Arguments     : req, res
******************************************************************************/
exports.sendSignupOTP = function(req, res) {
    let data = req.body.data ? req.body.data : req.body;
    var fnm = "sendSignupOTP";
    
    const { phonenumber } = data;
    
    if (!phonenumber || phonenumber.length !== 10) {
        return res.status(std.message["BAD_REQUEST"].code).json({
            status: std.message["BAD_REQUEST"].code,
            message: 'Please provide a valid 10-digit mobile number',
            data: null
        });
    }
    
    // Check if user already exists
    authAppMdl.findUserByPhoneMdl({ phoneNumber: phonenumber })
        .then(function(userResults) {
            console.log(userResults, 'findUserByPhoneMdl results (signup)');
            const user = userResults && userResults.length > 0 ? userResults[0] : null;
            
            // Check if user already registered
            if (user) {
                return res.status(409).json({
                    status: 409,
                    message: 'User already registered. Please login instead.',
                    data: null
                });
            }
            
            // Store the OTP and send it by SMS (new user)
            return issueOtp(phonenumber, null).then(function(issued) {
                const ctx = audit.reqCtx(req);
                audit.writeAudit({
                    userId: null,
                    action: 'otp_sent',
                    entityType: 'user',
                    newVal: { phone: '******' + phonenumber.slice(-4), otpID: issued.otpId },
                    ip: ctx.ip,
                    userAgent: ctx.userAgent
                });

                return df.formatSucessRes(req, res, {
                    otpID: issued.otpId,
                    usr_id: null,
                    status: 'sent',
                    user_message: 'OTP has been sent to your mobile number',
                    show_fallback_message: false,
                    dev_otp: issued.devOtp
                }, cntxtDtls, fnm, {});
            });
        })
        .catch(function(error) {
            console.error('[sendSignupOTP] Error:', error);
            return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
        });
};

/*****************************************************************************
* Function      : verifyOTP
* Description   : Verify OTP and login
* Arguments     : req, res
******************************************************************************/
exports.verifyOTP = function(req, res) {
    let data = req.body.data ? req.body.data : req.body;
    var fnm = "verifyOTP";
    
    const { phno, otp, otpID, usr_id } = data;
    
    if (!phno || !otp) {
        return res.status(std.message["BAD_REQUEST"].code).json({
            status: std.message["BAD_REQUEST"].code,
            message: 'Phone number and OTP are required',
            data: null
        });
    }
    
    // Check against the LATEST unexpired OTP for this number, with an attempt
    // cap so a 4-digit code cannot be brute-forced within its validity window.
    const maxAttempts = config.otp.maxAttempts || 3;
    authAppMdl.getValidOTPMdl({ phoneNumber: phno })
        .then(function(otpResults) {
            if (!otpResults || otpResults.length === 0) {
                return res.status(std.message["INVALID_OTP"].code).json({
                    status: std.message["INVALID_OTP"].code,
                    message: 'Invalid or expired OTP',
                    data: null
                });
            }

            const otpRecord = otpResults[0];

            if ((Number(otpRecord.attmpts_nbr) || 0) >= maxAttempts) {
                return res.status(std.message["MAX_ATTEMPTS"].code).json({
                    status: std.message["MAX_ATTEMPTS"].code,
                    message: 'Too many incorrect attempts. Please request a new OTP.',
                    data: null
                });
            }

            if (String(otpRecord.otp_tx) !== String(otp).trim()) {
                return authAppMdl.incrementOTPAttemptsMdl({ otpId: otpRecord.otp_id })
                    .then(function() {
                        return res.status(std.message["INVALID_OTP"].code).json({
                            status: std.message["INVALID_OTP"].code,
                            message: 'Invalid or expired OTP',
                            data: null
                        });
                    });
            }

            // Mark OTP as verified
            return authAppMdl.markOTPVerifiedMdl({ otpId: otpRecord.otp_id })
                .then(function() {
                    // Check if user exists
                    return authAppMdl.findUserByPhoneMdl({ phoneNumber: phno })
                        .then(function(userResults) {
                            if (!userResults || userResults.length === 0) {
                                // For signup flow
                                return df.formatSucessRes(req, res, {
                                    verified: true,
                                    phoneNumber: phno,
                                    requiresRegistration: true
                                }, cntxtDtls, fnm, {});
                            }
                            
                            const user = userResults[0];
                            
                            // Generate JWT token
                            const token = jwt.sign(
                                { 
                                    userId: user.usr_id,
                                    phone: user.phn_nmbr_tx,
                                    userType: user.usr_typ_cd 
                                },
                                config.jwtSecret || config.jwt.secret,
                                { expiresIn: config.jwt.expiresIn || '30d' }
                            );
                            
                            const ctx = audit.reqCtx(req);
                            audit.writeAudit({
                                userId: user.usr_id,
                                action: 'login',
                                entityType: 'user',
                                entityId: user.usr_id,
                                newVal: { method: 'otp', userType: user.usr_typ_cd },
                                ip: ctx.ip,
                                userAgent: ctx.userAgent
                            });

                            return res.json({
                                status: std.message["SUCCESS"].code,
                                message: 'Login successful',
                                token: token,
                                data: {
                                    user: {
                                        usr_id: user.usr_id,
                                        mobile: user.phn_nmbr_tx,
                                        name: user.nm_tx,
                                        email: user.eml_tx,
                                        userType: user.usr_typ_cd
                                    },
                                    clnts: [{
                                        client_id: 'client_001',
                                        client_name: 'Main Client'
                                    }]
                                }
                            });
                        });
                });
        })
        .catch(function(error) {
            console.error('[verifyOTP] Error:', error);
            return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
        });
};

/*****************************************************************************
* Function      : resendOTP
* Description   : Resend OTP to mobile number
* Arguments     : req, res
******************************************************************************/
exports.resendOTP = function(req, res) {
    // Reuse sendOTP logic
    return exports.sendOTP(req, res);
};

/*****************************************************************************
* Function      : getUserInfo
* Description   : Get user info (protected route)
* Arguments     : req, res
******************************************************************************/
exports.getUserInfo = function(req, res) {
    var fnm = "getUserInfo";
    const phoneNumber = req.user.phone || req.user.mobile;
    
    authAppMdl.findUserByPhoneMdl({ phoneNumber: phoneNumber })
        .then(function(results) {
            if (!results || results.length === 0) {
                return res.status(std.message["NOT_FOUND"].code).json({
                    status: std.message["NOT_FOUND"].code,
                    message: 'User not found',
                    data: null
                });
            }
            
            const user = results[0];
            return df.formatSucessRes(req, res, {
                usr_id: user.usr_id,
                phone: user.phn_nmbr_tx,
                name: user.nm_tx,
                email: user.eml_tx,
                userType: user.usr_typ_cd
            }, cntxtDtls, fnm, {});
        })
        .catch(function(error) {
            console.error('[getUserInfo] Error:', error);
            return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
        });
};

/*****************************************************************************
* Function      : login
* Description   : Admin web console login (email + password, no OTP).
*                 Verifies SHA1(password) against usr_lst_t.pswd_hash_tx and
*                 returns a JWT pair in the shape the frontend expects:
*                 { user, accessToken, refreshToken }.
* Arguments     : req, res
******************************************************************************/
exports.login = function(req, res) {
    let data = req.body.data ? req.body.data : req.body;
    var fnm = "login";

    const { email, password } = data;

    if (!email || !password) {
        return res.status(std.message["BAD_REQUEST"].code).json({
            status: std.message["BAD_REQUEST"].code,
            error: 'Email and password are required',
            data: null
        });
    }

    authAppMdl.findAdminByEmailMdl({ email: email })
        .then(function(results) {
            const user = results && results.length > 0 ? results[0] : null;

            if (!user || !user.pswd_hash_tx) {
                const ctx = audit.reqCtx(req);
                audit.writeAudit({
                    userId: null,
                    action: 'login_failed',
                    entityType: 'user',
                    newVal: { email: email, reason: 'user not found' },
                    ip: ctx.ip,
                    userAgent: ctx.userAgent
                });
                return res.status(std.message["UNAUTHORIZED"].code).json({
                    status: std.message["UNAUTHORIZED"].code,
                    error: 'Invalid email or password',
                    data: null
                });
            }

            // SHA1 (hex) comparison — matches pswd_hash_tx storage.
            const hash = crypto.createHash('sha1').update(password).digest('hex');
            if (hash !== user.pswd_hash_tx) {
                const ctx = audit.reqCtx(req);
                audit.writeAudit({
                    userId: null,
                    action: 'login_failed',
                    entityType: 'user',
                    newVal: { email: email, reason: 'invalid password' },
                    ip: ctx.ip,
                    userAgent: ctx.userAgent
                });
                return res.status(std.message["UNAUTHORIZED"].code).json({
                    status: std.message["UNAUTHORIZED"].code,
                    error: 'Invalid email or password',
                    data: null
                });
            }

            // Restrict the admin console to admin accounts only.
            if (user.usr_typ_cd !== 'admin') {
                return res.status(std.message["FORBIDDEN"].code).json({
                    status: std.message["FORBIDDEN"].code,
                    error: 'Admin access only',
                    data: null
                });
            }

            const payload = {
                userId: user.usr_id,
                email: user.eml_tx,
                userType: user.usr_typ_cd
            };

            const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_EXPIRES_IN });
            const refreshToken = jwt.sign(payload, JWT_SECRET, { expiresIn: REFRESH_EXPIRES_IN });

            const ctx = audit.reqCtx(req);
            audit.writeAudit({
                userId: user.usr_id,
                action: 'login',
                entityType: 'user',
                entityId: user.usr_id,
                newVal: { method: 'password', console: 'web' },
                ip: ctx.ip,
                userAgent: ctx.userAgent
            });

            return res.status(std.message["SUCCESS"].code).json({
                status: std.message["SUCCESS"].code,
                message: 'Login successful',
                user: toAdminUser(user),
                accessToken: accessToken,
                refreshToken: refreshToken
            });
        })
        .catch(function(error) {
            console.error('[login] Error:', error);
            return res.status(std.message["INTERNAL_ERROR"].code).json({
                status: std.message["INTERNAL_ERROR"].code,
                error: 'Login failed',
                data: null
            });
        });
};

/*****************************************************************************
* Function      : getMe
* Description   : Return the currently authenticated admin's profile.
*                 Protected by accessCtrl.verifyToken (sets req.user).
* Arguments     : req, res
******************************************************************************/
exports.getMe = function(req, res) {
    var fnm = "getMe";

    authAppMdl.getAdminByIdMdl({ userId: req.user.userId })
        .then(function(results) {
            const user = results && results.length > 0 ? results[0] : null;

            if (!user) {
                return res.status(std.message["NOT_FOUND"].code).json({
                    status: std.message["NOT_FOUND"].code,
                    error: 'User not found',
                    data: null
                });
            }

            return res.status(std.message["SUCCESS"].code).json({
                status: std.message["SUCCESS"].code,
                user: toAdminUser(user)
            });
        })
        .catch(function(error) {
            console.error('[getMe] Error:', error);
            return res.status(std.message["INTERNAL_ERROR"].code).json({
                status: std.message["INTERNAL_ERROR"].code,
                error: 'Failed to fetch profile',
                data: null
            });
        });
};

/*****************************************************************************
* Function      : refresh
* Description   : Issue a new access token from a valid refresh token.
* Arguments     : req, res
******************************************************************************/
exports.refresh = function(req, res) {
    let data = req.body.data ? req.body.data : req.body;

    const { refreshToken } = data;

    if (!refreshToken) {
        return res.status(std.message["UNAUTHORIZED"].code).json({
            status: std.message["UNAUTHORIZED"].code,
            error: 'No refresh token provided',
            data: null
        });
    }

    jwt.verify(refreshToken, JWT_SECRET, function(err, decoded) {
        if (err) {
            return res.status(std.message["UNAUTHORIZED"].code).json({
                status: std.message["UNAUTHORIZED"].code,
                error: 'Invalid or expired refresh token',
                data: null
            });
        }

        const payload = {
            userId: decoded.userId,
            email: decoded.email,
            userType: decoded.userType
        };

        const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_EXPIRES_IN });

        const ctx = audit.reqCtx(req);
        audit.writeAudit({
            userId: decoded.userId,
            action: 'token_refresh',
            entityType: 'user',
            entityId: decoded.userId,
            ip: ctx.ip,
            userAgent: ctx.userAgent
        });

        return res.status(std.message["SUCCESS"].code).json({
            status: std.message["SUCCESS"].code,
            accessToken: accessToken
        });
    });
};

/*****************************************************************************
* Function      : logout
* Description   : Stateless logout (token discarded client-side).
* Arguments     : req, res
******************************************************************************/
exports.logout = function(req, res) {
    return res.status(std.message["SUCCESS"].code).json({
        status: std.message["SUCCESS"].code,
        message: 'Logged out successfully'
    });
};
