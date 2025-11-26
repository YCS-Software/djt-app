/**
 * Profile Controller
 * Handles user profile and statistics
 */

const std = require(appRoot + '/utils/standardMessages');
const df = require(appRoot + '/utils/dateFormatUtil');
const authAppMdl = require('../../auth/models/authAppMdl');
const dashboardMdl = require('../../dashboard/models/dashboardMdl');
const cntxtDtls = "profileCtrl";

// Dummy user profile data
const DUMMY_USER_PROFILE = {
    usr_id: 0,
    name: 'John Doe',
    email: 'john.doe@example.com',
    phone: '9666476298',
    profile_image: null,
    created_at: new Date().toISOString()
};

// Dummy user stats
const DUMMY_USER_STATS = {
    total_sessions: 47,
    total_energy_kwh: 1245.5,
    total_spent: 12400.00,
    co2_saved_kg: 124.5
};

/*****************************************************************************
* Function      : getProfile
* Description   : Get user profile with statistics
* Arguments     : req, res
******************************************************************************/
exports.getProfile = function(req, res) {
    var fnm = "getProfile";
    const userId = req.user.userId;
    
    // Fetch user profile and stats in parallel
    Promise.all([
        authAppMdl.getUserByIdMdl({ userId: userId }).catch(() => null),
        dashboardMdl.getUserStatsMdl({ userId: userId }).catch(() => null)
    ])
    .then(function([userResults, statsResults]) {
        let user = DUMMY_USER_PROFILE;
        let stats = DUMMY_USER_STATS;
        
        // Get user data
        if (userResults && userResults.length > 0) {
            const userData = userResults[0];
            user = {
                usr_id: userData.usr_id,
                name: userData.nm_tx || 'User',
                email: userData.eml_tx || '',
                phone: userData.phn_nmbr_tx || '',
                profile_image: userData.prfl_img_tx || null,
                created_at: userData.i_ts || new Date().toISOString()
            };
        }
        
        // Get stats data
        if (statsResults && statsResults.length > 0) {
            stats = {
                total_sessions: parseInt(statsResults[0].ttl_sssns_nbr) || 0,
                total_energy_kwh: parseFloat(statsResults[0].ttl_enrgy_kwh) || 0,
                total_spent: parseFloat(statsResults[0].ttl_spnt_amt) || 0,
                co2_saved_kg: parseFloat(statsResults[0].co2_svd_kg) || 0
            };
        }
        
        return df.formatSucessRes(req, res, {
            user: user,
            stats: stats
        }, cntxtDtls, fnm, {});
    })
    .catch(function(error) {
        console.error('[getProfile] Error:', error);
        // Return dummy data on error
        return df.formatSucessRes(req, res, {
            user: DUMMY_USER_PROFILE,
            stats: DUMMY_USER_STATS
        }, cntxtDtls, fnm, {});
    });
};

