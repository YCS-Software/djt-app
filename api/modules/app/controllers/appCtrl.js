/**
 * App Controller
 * Tells the mobile app whether its version is still supported, so an update can
 * be made mandatory from the server without shipping new code.
 *
 * ONE setting in .env controls it:
 *
 *   APP_MIN_VERSION_CODE=18
 *
 * This is the oldest Android build number (versionCode in
 * mobile_app/android/app/build.gradle) that is still allowed to run. Any older
 * build gets a blocking "Update required" screen with a button to the Play
 * Store. Leave it unset (or 0) and no update is ever requested.
 */

const df = require(appRoot + '/utils/dateFormatUtil');
const cntxtDtls = 'appCtrl';

// Where the "Update now" button sends the user.
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.djthaika.ev';

/**
 * GET /api/app/version?platform=android&version_code=18
 * Public (called before login).
 */
exports.getVersion = function(req, res) {
    const fnm = 'getVersion';
    try {
        const platform = String(req.query.platform || 'android').toLowerCase() === 'ios' ? 'ios' : 'android';

        // The setting is an Android build number; iOS builds are numbered
        // separately, so it is not applied to them.
        const configured = parseInt(process.env.APP_MIN_VERSION_CODE, 10);
        const minCode = platform === 'android' && Number.isFinite(configured) && configured > 0 ? configured : 0;

        const current = parseInt(req.query.version_code, 10);
        const known = Number.isFinite(current) && current > 0;

        return df.formatSucessRes(req, res, {
            platform: platform,
            min_version_code: minCode,
            current_version_code: known ? current : null,
            update_required: known ? current < minCode : false,
            update_url: platform === 'android' ? PLAY_STORE_URL : null,
        }, cntxtDtls, fnm, {});
    } catch (error) {
        return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
    }
};
