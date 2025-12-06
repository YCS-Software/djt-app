const jwt = require('jsonwebtoken');
const std = require(appRoot + '/utils/standardMessages');
const config = require(appRoot + '/config/config');
const df = require(appRoot + '/utils/dateFormatUtil');
const authAppMdl = require('../models/authAppMdl');
const cntxtDtls = "authAppCtrl";

// Generate random OTP
const generateOTP = () => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

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
    
    // Generate OTP
    let otp =  '9999' ;
    const expiryMinutes = config.otp.expiryMinutes || 5;
    
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
            
            // Store OTP in database
            return authAppMdl.storeOTPMdl({
                phoneNumber: phonenumber,
                otp: otp,
                expiryMinutes: expiryMinutes
            }).then(function(otpResults) {
                // Log OTP for development
                console.log(`\n📱 OTP for ${phonenumber}: ${otp}`);
                console.log(`⏰ Expires in: ${expiryMinutes} minutes\n`);
                
                return df.formatSucessRes(req, res, {
                    otpID: otpResults.insertId,
                    usr_id: user.usr_id,
                    status: 'sent',
                    user_message: 'OTP has been sent to your mobile number',
                    show_fallback_message: false,
                    dev_otp: process.env.NODE_ENV === 'development' ? otp : undefined
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
    
    // Generate OTP
    const otp =9999; //generateOTP();
    const expiryMinutes = config.otp.expiryMinutes || 5;
    
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
            
            // Store OTP in database for new user
            return authAppMdl.storeOTPMdl({
                phoneNumber: phonenumber,
                otp: otp,
                expiryMinutes: expiryMinutes
            }).then(function(otpResults) {
                // Log OTP for development
                console.log(`\n📱 Signup OTP for ${phonenumber}: ${otp}`);
                console.log(`⏰ Expires in: ${expiryMinutes} minutes\n`);
                
                return df.formatSucessRes(req, res, {
                    otpID: otpResults.insertId,
                    usr_id: null,
                    status: 'sent',
                    user_message: 'OTP has been sent to your mobile number',
                    show_fallback_message: false,
                    dev_otp: process.env.NODE_ENV === 'development' ? otp : undefined
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
    
    // Verify OTP from database
    authAppMdl.verifyOTPMdl({ phoneNumber: phno, otp: otp })
        .then(function(otpResults) {
            if (!otpResults || otpResults.length === 0) {
                return res.status(std.message["INVALID_OTP"].code).json({
                    status: std.message["INVALID_OTP"].code,
                    message: 'Invalid or expired OTP',
                    data: null
                });
            }
            
            const otpRecord = otpResults[0];
            
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
