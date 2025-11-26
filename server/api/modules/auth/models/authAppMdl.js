/**
 * Auth App Model
 * Handles authentication-related database operations
 */

const sqldb = require(appRoot + '/config/db.config');
const dbutil = require(appRoot + '/utils/db.utils');
const cntxtDtls = "authAppMdl";

/*****************************************************************************
* Function      : storeOTPMdl
* Description   : Store OTP in database
* Arguments     : data object with phoneNumber, otp, expiryMinutes
******************************************************************************/
exports.storeOTPMdl = function(data) {
    const expiryTime = new Date(Date.now() + data.expiryMinutes * 60000);
    const expiryTimestamp = expiryTime.toISOString().slice(0, 19).replace('T', ' ');
    
    const QRY_TO_EXEC = `INSERT INTO auth_otp_t 
        (phn_nmbr_tx, otp_tx, expry_ts, attmpts_nbr, is_vrfd_in, a_in) 
        VALUES 
        ('${data.phoneNumber}', '${data.otp}', '${expiryTimestamp}', 0, 0, 1)`;
    
    console.log('[storeOTPMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};

/*****************************************************************************
* Function      : getValidOTPMdl
* Description   : Get valid OTP for phone number
* Arguments     : data object with phoneNumber
******************************************************************************/
exports.getValidOTPMdl = function(data) {
    const QRY_TO_EXEC = `SELECT * FROM auth_otp_t
        WHERE phn_nmbr_tx = '${data.phoneNumber}'
        AND is_vrfd_in = 0
        AND a_in = 1
        AND expry_ts > NOW()
        ORDER BY i_ts DESC
        LIMIT 1`;
    
    console.log('[getValidOTPMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};

/*****************************************************************************
* Function      : verifyOTPMdl
* Description   : Verify OTP and update status
* Arguments     : data object with phoneNumber, otp
******************************************************************************/
exports.verifyOTPMdl = function(data) {
    const QRY_TO_EXEC = `SELECT * FROM auth_otp_t
        WHERE phn_nmbr_tx = '${data.phoneNumber}'
        AND otp_tx = '${data.otp}'
        AND is_vrfd_in = 0
        AND a_in = 1
        AND expry_ts > NOW()
        ORDER BY i_ts DESC
        LIMIT 1`;
    
    console.log('[verifyOTPMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};

/*****************************************************************************
* Function      : markOTPVerifiedMdl
* Description   : Mark OTP as verified
* Arguments     : data object with otpId
******************************************************************************/
exports.markOTPVerifiedMdl = function(data) {
    const QRY_TO_EXEC = `UPDATE auth_otp_t 
        SET is_vrfd_in = 1, 
            vrfd_ts = NOW() 
        WHERE otp_id = ${data.otpId}`;
    
    console.log('[markOTPVerifiedMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};

/*****************************************************************************
* Function      : incrementOTPAttemptsMdl
* Description   : Increment OTP verification attempts
* Arguments     : data object with otpId
******************************************************************************/
exports.incrementOTPAttemptsMdl = function(data) {
    const QRY_TO_EXEC = `UPDATE auth_otp_t 
        SET attmpts_nbr = attmpts_nbr + 1 
        WHERE otp_id = ${data.otpId}`;
    
    console.log('[incrementOTPAttemptsMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};

/*****************************************************************************
* Function      : findUserByPhoneMdl
* Description   : Find user by phone number
* Arguments     : data object with phoneNumber
******************************************************************************/
exports.findUserByPhoneMdl = function(data) {
    const QRY_TO_EXEC = `SELECT * FROM users_t 
        WHERE phn_nmbr_tx = '${data.phoneNumber}' 
        AND a_in = 1 
        LIMIT 1`;
    
    console.log('[findUserByPhoneMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};

/*****************************************************************************
* Function      : createUserMdl
* Description   : Create new user
* Arguments     : data object with phone, name, email
******************************************************************************/
exports.createUserMdl = function(data) {
    const emailValue = data.email ? `'${data.email}'` : 'NULL';
    
    const QRY_TO_EXEC = `INSERT INTO users_t 
        (phn_nmbr_tx, nm_tx, eml_tx, usr_typ_cd, a_in) 
        VALUES 
        ('${data.phone}', '${data.name}', ${emailValue}, 'customer', 1)`;
    
    console.log('[createUserMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};

/*****************************************************************************
* Function      : findUserByEmailMdl
* Description   : Find user by email
* Arguments     : data object with email
******************************************************************************/
exports.findUserByEmailMdl = function(data) {
    const QRY_TO_EXEC = `SELECT * FROM users_t 
        WHERE eml_tx = '${data.email}' 
        AND a_in = 1 
        LIMIT 1`;
    
    console.log('[findUserByEmailMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};

/*****************************************************************************
* Function      : getUserByIdMdl
* Description   : Get user by ID
* Arguments     : data object with userId
******************************************************************************/
exports.getUserByIdMdl = function(data) {
    const QRY_TO_EXEC = `SELECT * FROM users_t 
        WHERE usr_id = ${data.userId} 
        AND a_in = 1 
        LIMIT 1`;
    
    console.log('[getUserByIdMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};

/*****************************************************************************
* Function      : updateUserProfileMdl
* Description   : Update user profile
* Arguments     : data object with userId, name, email, profileImage
******************************************************************************/
exports.updateUserProfileMdl = function(data) {
    const updates = [];
    if (data.name) updates.push(`nm_tx = '${data.name}'`);
    if (data.email) updates.push(`eml_tx = '${data.email}'`);
    if (data.profileImage) updates.push(`prfl_img_tx = '${data.profileImage}'`);
    updates.push(`u_ts = NOW()`);
    updates.push(`updte_usr_id = ${data.userId}`);
    
    const QRY_TO_EXEC = `UPDATE users_t 
        SET ${updates.join(', ')} 
        WHERE usr_id = ${data.userId}`;
    
    console.log('[updateUserProfileMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};
