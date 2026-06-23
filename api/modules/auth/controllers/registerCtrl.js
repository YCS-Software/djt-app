/**
 * User Registration Controller
 * Handles user signup and profile creation
 */

const jwt = require('jsonwebtoken');
const std = require(appRoot + '/utils/standardMessages');
const config = require(appRoot + '/config/config');
const df = require(appRoot + '/utils/dateFormatUtil');
const authAppMdl = require('../models/authAppMdl');
const cntxtDtls = "registerCtrl";

/*****************************************************************************
* Function      : register
* Description   : Register new user
* Arguments     : req, res
******************************************************************************/
exports.register = function(req, res) {
    let data = req.body.data ? req.body.data : req.body;
    var fnm = "register";
    
    const { phone, name, email } = data;
    // Role: 'customer' (default) or 'owner' (EV station owner)
    const userType = (data.userType === 'owner') ? 'owner' : 'customer';

    // Validation
    if (!phone || !name) {
        return res.status(std.message["BAD_REQUEST"].code).json({
            status: std.message["BAD_REQUEST"].code,
            message: 'Phone number and name are required',
            data: null
        });
    }
    
    // Validate phone number
    if (phone.length !== 10) {
        return res.status(std.message["BAD_REQUEST"].code).json({
            status: std.message["BAD_REQUEST"].code,
            message: 'Please provide a valid 10-digit mobile number',
            data: null
        });
    }
    
    // Validate email if provided
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(std.message["BAD_REQUEST"].code).json({
            status: std.message["BAD_REQUEST"].code,
            message: 'Please provide a valid email address',
            data: null
        });
    }
    
    // Check if user already exists
    authAppMdl.findUserByPhoneMdl({ phoneNumber: phone })
        .then(function(userResults) {
            console.log('tttttttttttttttttttttttttttt')
            if (userResults && userResults.length > 0) {
                return res.status(409).json({
                    status: 409,
                    message: 'User with this phone number already exists',
                    data: null
                });
            }
            
            // Check if email already exists (if provided)
            if (email) {
                return authAppMdl.findUserByEmailMdl({ email: email })
                    .then(function(emailResults) {
                        if (emailResults && emailResults.length > 0) {
                            return res.status(409).json({
                                status: 409,
                                message: 'User with this email already exists',
                                data: null
                            });
                        }
                        
                        // Create user
                        return createUser({ phone, name, email, userType }, req, res, fnm);
                    });
            } else {
                // Create user without email check
                return createUser({ phone, name, email, userType }, req, res, fnm);
            }
        })
        .catch(function(error) {
            console.error('[register] Error:', error);
            return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
        });
};

// Helper function to create user
function createUser(userData, req, res, fnm) {
    const { phone, name, email } = userData;
    const userType = (userData.userType === 'owner') ? 'owner' : 'customer';

    authAppMdl.createUserMdl({ phone, name, email, userType })
        .then(function(createResults) {
            if (!createResults || !createResults.insertId) {
                return res.status(500).json({
                    status: 500,
                    message: 'Failed to create user account',
                    data: null
                });
            }

            const userId = createResults.insertId;

            // Generate JWT token
            const token = jwt.sign(
                {
                    userId: userId,
                    phone: phone,
                    userType: userType
                },
                config.jwtSecret || config.jwt.secret,
                { expiresIn: config.jwt.expiresIn || '30d' }
            );

            return res.json({
                status: std.message["SUCCESS"].code,
                message: 'Account created successfully',
                data: {
                    user: {
                        usr_id: userId,
                        phone: phone,
                        name: name,
                        email: email,
                        userType: userType,
                        profileImage: null
                    },
                    token: token
                }
            });
        })
        .catch(function(error) {
            console.error('[createUser] Error:', error);
            return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
        });
}

/*****************************************************************************
* Function      : updateProfile
* Description   : Update user profile
* Arguments     : req, res
******************************************************************************/
exports.updateProfile = function(req, res) {
    let data = req.body.data ? req.body.data : req.body;
    var fnm = "updateProfile";
    
    const userId = req.user.userId; // From auth middleware
    const { name, email, profileImage } = data;
    
    // Check if email is being changed and already exists
    if (email) {
        authAppMdl.findUserByEmailMdl({ email: email })
            .then(function(emailResults) {
                if (emailResults && emailResults.length > 0 && emailResults[0].usr_id !== userId) {
                    return res.status(409).json({
                        status: 409,
                        message: 'Email already in use by another account',
                        data: null
                    });
                }
                
                // Update user profile
                return authAppMdl.updateUserProfileMdl({ userId, name, email, profileImage })
                    .then(function(updateResults) {
                        if (!updateResults) {
                            return res.status(500).json({
                                status: 500,
                                message: 'Failed to update profile',
                                data: null
                            });
                        }
                        
                        // Fetch updated user data
                        return authAppMdl.getUserByIdMdl({ userId: userId })
                            .then(function(userResults) {
                                if (!userResults || userResults.length === 0) {
                                    return res.status(404).json({
                                        status: 404,
                                        message: 'User not found',
                                        data: null
                                    });
                                }
                                
                                const user = userResults[0];
                                return df.formatSucessRes(req, res, {
                                    user: {
                                        usr_id: user.usr_id,
                                        phone: user.phn_nmbr_tx,
                                        name: user.nm_tx,
                                        email: user.eml_tx,
                                        userType: user.usr_typ_cd,
                                        profileImage: user.prfl_img_tx
                                    }
                                }, cntxtDtls, fnm, {});
                            });
                    });
            })
            .catch(function(error) {
                console.error('[updateProfile] Error:', error);
                return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
            });
    } else {
        // Update without email check
        authAppMdl.updateUserProfileMdl({ userId, name, email, profileImage })
            .then(function(updateResults) {
                if (!updateResults) {
                    return res.status(500).json({
                        status: 500,
                        message: 'Failed to update profile',
                        data: null
                    });
                }
                
                // Fetch updated user data
                return authAppMdl.getUserByIdMdl({ userId: userId })
                    .then(function(userResults) {
                        if (!userResults || userResults.length === 0) {
                            return res.status(404).json({
                                status: 404,
                                message: 'User not found',
                                data: null
                            });
                        }
                        
                        const user = userResults[0];
                        return df.formatSucessRes(req, res, {
                            user: {
                                usr_id: user.usr_id,
                                phone: user.phn_nmbr_tx,
                                name: user.nm_tx,
                                email: user.eml_tx,
                                userType: user.usr_typ_cd,
                                profileImage: user.prfl_img_tx
                            }
                        }, cntxtDtls, fnm, {});
                    });
            })
            .catch(function(error) {
                console.error('[updateProfile] Error:', error);
                return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
            });
    }
};
