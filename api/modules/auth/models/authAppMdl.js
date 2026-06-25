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
    
    const QRY_TO_EXEC = `INSERT INTO otp_lst_t
        (phn_nmbr_tx, otp_tx, expry_ts, attmpts_nbr, is_vrfd_in, a_in)
        VALUES
        (?, ?, ?, 0, 0, 1)`;
    const PARAMS = [data.phoneNumber, data.otp, expiryTimestamp];

    console.log('[storeOTPMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

/*****************************************************************************
* Function      : getValidOTPMdl
* Description   : Get valid OTP for phone number
* Arguments     : data object with phoneNumber
******************************************************************************/
exports.getValidOTPMdl = function(data) {
    const QRY_TO_EXEC = `SELECT * FROM otp_lst_t
        WHERE phn_nmbr_tx = ?
        AND is_vrfd_in = 0
        AND a_in = 1
        AND expry_ts > NOW()
        ORDER BY i_ts DESC
        LIMIT 1`;
    const PARAMS = [data.phoneNumber];

    console.log('[getValidOTPMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

/*****************************************************************************
* Function      : verifyOTPMdl
* Description   : Verify OTP and update status
* Arguments     : data object with phoneNumber, otp
******************************************************************************/
exports.verifyOTPMdl = function(data) {
    const QRY_TO_EXEC = `SELECT * FROM otp_lst_t
        WHERE phn_nmbr_tx = ?
        AND otp_tx = ?
        AND is_vrfd_in = 0
        AND a_in = 1
        AND expry_ts > NOW()
        ORDER BY i_ts DESC
        LIMIT 1`;
    const PARAMS = [data.phoneNumber, data.otp];

    console.log('[verifyOTPMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

/*****************************************************************************
* Function      : markOTPVerifiedMdl
* Description   : Mark OTP as verified
* Arguments     : data object with otpId
******************************************************************************/
exports.markOTPVerifiedMdl = function(data) {
    const QRY_TO_EXEC = `UPDATE otp_lst_t
        SET is_vrfd_in = 1,
            vrfd_ts = NOW()
        WHERE otp_id = ?`;
    const PARAMS = [data.otpId];

    console.log('[markOTPVerifiedMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

/*****************************************************************************
* Function      : incrementOTPAttemptsMdl
* Description   : Increment OTP verification attempts
* Arguments     : data object with otpId
******************************************************************************/
exports.incrementOTPAttemptsMdl = function(data) {
    const QRY_TO_EXEC = `UPDATE otp_lst_t
        SET attmpts_nbr = attmpts_nbr + 1
        WHERE otp_id = ?`;
    const PARAMS = [data.otpId];

    console.log('[incrementOTPAttemptsMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

/*****************************************************************************
* Function      : findUserByPhoneMdl
* Description   : Find user by phone number
* Arguments     : data object with phoneNumber
******************************************************************************/
exports.findUserByPhoneMdl = function(data) {
    const QRY_TO_EXEC = `SELECT * FROM usr_lst_t
        WHERE phn_nmbr_tx = ?
        AND a_in = 1
        LIMIT 1`;
    const PARAMS = [data.phoneNumber];

    console.log('[findUserByPhoneMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

/*****************************************************************************
* Function      : createUserMdl
* Description   : Create new user
* Arguments     : data object with phone, name, email
******************************************************************************/
exports.createUserMdl = function(data) {
    const emailValue = data.email ? data.email : null;
    // Only allow known roles; default to customer
    const allowedTypes = ['customer', 'owner'];
    const userType = allowedTypes.indexOf(data.userType) !== -1 ? data.userType : 'customer';

    const QRY_TO_EXEC = `INSERT INTO usr_lst_t
        (phn_nmbr_tx, nm_tx, eml_tx, usr_typ_cd, a_in)
        VALUES
        (?, ?, ?, ?, 1)`;
    const PARAMS = [data.phone, data.name, emailValue, userType];

    console.log('[createUserMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

/*****************************************************************************
* Function      : findUserByEmailMdl
* Description   : Find user by email
* Arguments     : data object with email
******************************************************************************/
exports.findUserByEmailMdl = function(data) {
    const QRY_TO_EXEC = `SELECT * FROM usr_lst_t
        WHERE eml_tx = ?
        AND a_in = 1
        LIMIT 1`;
    const PARAMS = [data.email];

    console.log('[findUserByEmailMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

/*****************************************************************************
* Function      : getUserByIdMdl
* Description   : Get user by ID
* Arguments     : data object with userId
******************************************************************************/
exports.getUserByIdMdl = function(data) {
    const QRY_TO_EXEC = `SELECT * FROM usr_lst_t
        WHERE usr_id = ?
        AND a_in = 1
        LIMIT 1`;
    const PARAMS = [data.userId];

    console.log('[getUserByIdMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

/*****************************************************************************
* Function      : updateUserProfileMdl
* Description   : Update user profile
* Arguments     : data object with userId, name, email, profileImage
******************************************************************************/
exports.updateUserProfileMdl = function(data) {
    const updates = [];
    const PARAMS = [];
    if (data.name) { updates.push(`nm_tx = ?`); PARAMS.push(data.name); }
    if (data.email) { updates.push(`eml_tx = ?`); PARAMS.push(data.email); }
    if (data.profileImage) { updates.push(`prfl_img_tx = ?`); PARAMS.push(data.profileImage); }
    updates.push(`u_ts = NOW()`);
    updates.push(`updte_usr_id = ?`); PARAMS.push(data.userId);

    const QRY_TO_EXEC = `UPDATE usr_lst_t
        SET ${updates.join(', ')}
        WHERE usr_id = ?`;
    PARAMS.push(data.userId);

    console.log('[updateUserProfileMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

/*****************************************************************************
* Function      : findAdminByEmailMdl
* Description   : Find an active user by email (web console email/password
*                 login). Uses the live schema table `usr_lst_t` and the
*                 `pswd_hash_tx` (SHA1 hex) column.
* Arguments     : data object with email
******************************************************************************/
exports.findAdminByEmailMdl = function(data) {
    const QRY_TO_EXEC = `SELECT usr_id, eml_tx, nm_tx, pswd_hash_tx, usr_typ_cd, a_in
        FROM usr_lst_t
        WHERE eml_tx = ?
        AND a_in = 1
        LIMIT 1`;
    const PARAMS = [String(data.email)];

    console.log('[findAdminByEmailMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

/*****************************************************************************
* Function      : getAdminByIdMdl
* Description   : Get an active user by id from `usr_lst_t` (profile / me).
* Arguments     : data object with userId
******************************************************************************/
exports.getAdminByIdMdl = function(data) {
    const userId = parseInt(data.userId, 10);

    const QRY_TO_EXEC = `SELECT usr_id, eml_tx, nm_tx, prfl_img_tx, usr_typ_cd, a_in
        FROM usr_lst_t
        WHERE usr_id = ?
        AND a_in = 1
        LIMIT 1`;
    const PARAMS = [userId];

    console.log('[getAdminByIdMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};
