/**
 * Station Model
 * Handles station-related database operations
 */

const sqldb = require(appRoot + '/config/db.config');
const dbutil = require(appRoot + '/utils/db.utils');
const cntxtDtls = "stationMdl";

/*****************************************************************************
* Function      : getNearbyStationsMdl
* Description   : Get nearby stations within radius
* Arguments     : data object with latitude, longitude, radius
******************************************************************************/
exports.getNearbyStationsMdl = function(data) {
    const latitude = parseFloat(data.latitude);
    const longitude = parseFloat(data.longitude);
    const radius = parseInt(data.radius) || 50;
    
    const QRY_TO_EXEC = `
        SELECT *,
            (6371 * acos(
                cos(radians(?)) *
                cos(radians(ltde_nbr)) *
                cos(radians(lngtde_nbr) - radians(?)) +
                sin(radians(?)) *
                sin(radians(ltde_nbr))
            )) AS distance
        FROM sttn_lst_t
        WHERE a_in = 1
        HAVING distance < ?
        ORDER BY distance
        LIMIT 50
    `;
    const PARAMS = [latitude, longitude, latitude, radius];

    console.log('[getNearbyStationsMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

/*****************************************************************************
* Function      : getStationByIdMdl
* Description   : Get station by ID
* Arguments     : data object with stationId
******************************************************************************/
exports.getStationByIdMdl = function(data) {
    const QRY_TO_EXEC = `SELECT * FROM sttn_lst_t
        WHERE sttn_id = ?
        AND a_in = 1
        LIMIT 1`;
    const PARAMS = [data.stationId];

    console.log('[getStationByIdMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

/*****************************************************************************
* Function      : getStationByCodeMdl
* Description   : Get station by code
* Arguments     : data object with stationCode
******************************************************************************/
exports.getStationByCodeMdl = function(data) {
    const stationCode = String(data.stationCode);
    const QRY_TO_EXEC = `SELECT * FROM sttn_lst_t
        WHERE sttn_cd = ?
        AND a_in = 1
        LIMIT 1`;
    const PARAMS = [stationCode];

    console.log('[getStationByCodeMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

/*****************************************************************************
* Function      : getActiveStationsMdl
* Description   : Get all active stations
* Arguments     : data object (optional limit, offset)
******************************************************************************/
exports.getActiveStationsMdl = function(data) {
    const limit = Number.isFinite(+data.limit) && +data.limit ? Math.max(0, parseInt(data.limit, 10)) : 100;
    const offset = Number.isFinite(+data.offset) && +data.offset ? Math.max(0, parseInt(data.offset, 10)) : 0;

    const QRY_TO_EXEC = `SELECT * FROM sttn_lst_t
        WHERE a_in = 1
        ORDER BY sttn_nm_tx ASC
        LIMIT ${limit} OFFSET ${offset}`;
    const PARAMS = [];

    console.log('[getActiveStationsMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

/*****************************************************************************
* Function      : searchStationsMdl
* Description   : Search stations by name, code, address, or city
* Arguments     : data object with searchTerm
******************************************************************************/
exports.searchStationsMdl = function(data) {
    const searchTerm = String(data.searchTerm);
    const likeTerm = `%${searchTerm}%`;

    const QRY_TO_EXEC = `
        SELECT * FROM sttn_lst_t
        WHERE a_in = 1
        AND (sttn_nm_tx LIKE ?
             OR sttn_cd LIKE ?
             OR addr_tx LIKE ?
             OR cty_tx LIKE ?)
        ORDER BY sttn_nm_tx
        LIMIT 20
    `;
    const PARAMS = [likeTerm, likeTerm, likeTerm, likeTerm];

    console.log('[searchStationsMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

/*****************************************************************************
* Function      : updateRatingMdl
* Description   : Update station rating
* Arguments     : data object with stationId, newRating
******************************************************************************/
exports.updateRatingMdl = function(data) {
    const QRY_TO_EXEC = `
        UPDATE sttn_lst_t
        SET ttl_rtngs_nbr = ttl_rtngs_nbr + 1,
            rtng_nbr = ((rtng_nbr * ttl_rtngs_nbr) + ?) / (ttl_rtngs_nbr + 1)
        WHERE sttn_id = ?
    `;
    const PARAMS = [data.newRating, data.stationId];

    console.log('[updateRatingMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

/*****************************************************************************
* Function      : getStationConnectorsMdl
* Description   : Get connectors for a station
* Arguments     : data object with stationId
******************************************************************************/
exports.getStationConnectorsMdl = function(data) {
    const QRY_TO_EXEC = `SELECT * FROM cnntr_lst_t
        WHERE sttn_id = ?
        AND a_in = 1
        ORDER BY cnntr_id`;
    const PARAMS = [data.stationId];

    console.log('[getStationConnectorsMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

/*****************************************************************************
* Function      : getConnectorByIdMdl
* Description   : Get connector by ID
* Arguments     : data object with connectorId
******************************************************************************/
exports.getConnectorByIdMdl = function(data) {
    const QRY_TO_EXEC = `SELECT * FROM cnntr_lst_t
        WHERE cnntr_id = ?
        AND a_in = 1
        LIMIT 1`;
    const PARAMS = [data.connectorId];

    console.log('[getConnectorByIdMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

/*****************************************************************************
* Function      : getAvailableConnectorMdl
* Description   : Get available connector for a station
* Arguments     : data object with stationId, connectorType (optional)
******************************************************************************/
exports.getAvailableConnectorMdl = function(data) {
    const PARAMS = [];
    let whereClause = `sttn_id = ? AND is_avlbl_in = 1 AND a_in = 1`;
    PARAMS.push(data.stationId);

    if (data.connectorType) {
        const connectorType = String(data.connectorType);
        whereClause += ` AND cnntr_typ_cd = ?`;
        PARAMS.push(connectorType);
    }

    const QRY_TO_EXEC = `SELECT * FROM cnntr_lst_t
        WHERE ${whereClause}
        LIMIT 1`;

    console.log('[getAvailableConnectorMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

/*****************************************************************************
* Function      : getUserFavoritesMdl
* Description   : Get user favorite stations
* Arguments     : data object with userId
******************************************************************************/
exports.getUserFavoritesMdl = function(data) {
    const QRY_TO_EXEC = `
        SELECT s.*, f.i_ts as favorited_at
        FROM fvrt_lst_t f
        JOIN sttn_lst_t s ON f.sttn_id = s.sttn_id
        WHERE f.usr_id = ? AND f.a_in = 1 AND s.a_in = 1
        ORDER BY f.i_ts DESC
    `;
    const PARAMS = [data.userId];

    console.log('[getUserFavoritesMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

/*****************************************************************************
* Function      : addFavoriteMdl
* Description   : Add station to user favorites
* Arguments     : data object with userId, stationId
******************************************************************************/
exports.addFavoriteMdl = function(data) {
    const QRY_TO_EXEC = `INSERT INTO fvrt_lst_t
        (usr_id, sttn_id, a_in)
        VALUES
        (?, ?, 1)`;
    const PARAMS = [data.userId, data.stationId];

    console.log('[addFavoriteMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

/*****************************************************************************
* Function      : removeFavoriteMdl
* Description   : Remove station from user favorites
* Arguments     : data object with userId, stationId
******************************************************************************/
exports.removeFavoriteMdl = function(data) {
    const QRY_TO_EXEC = `UPDATE fvrt_lst_t
        SET a_in = 0
        WHERE usr_id = ?
        AND sttn_id = ?`;
    const PARAMS = [data.userId, data.stationId];

    console.log('[removeFavoriteMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

/*****************************************************************************
* Function      : isFavoriteMdl
* Description   : Check if station is user favorite
* Arguments     : data object with userId, stationId
******************************************************************************/
exports.isFavoriteMdl = function(data) {
    const QRY_TO_EXEC = `SELECT * FROM fvrt_lst_t
        WHERE usr_id = ?
        AND sttn_id = ?
        AND a_in = 1
        LIMIT 1`;
    const PARAMS = [data.userId, data.stationId];

    console.log('[isFavoriteMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, PARAMS, cntxtDtls);
};

