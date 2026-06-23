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
                cos(radians(${latitude})) * 
                cos(radians(ltde_nbr)) * 
                cos(radians(lngtde_nbr) - radians(${longitude})) + 
                sin(radians(${latitude})) * 
                sin(radians(ltde_nbr))
            )) AS distance
        FROM sttn_lst_t
        WHERE a_in = 1
        HAVING distance < ${radius}
        ORDER BY distance
        LIMIT 50
    `;
    
    console.log('[getNearbyStationsMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};

/*****************************************************************************
* Function      : getStationByIdMdl
* Description   : Get station by ID
* Arguments     : data object with stationId
******************************************************************************/
exports.getStationByIdMdl = function(data) {
    const QRY_TO_EXEC = `SELECT * FROM sttn_lst_t 
        WHERE sttn_id = ${data.stationId} 
        AND a_in = 1 
        LIMIT 1`;
    
    console.log('[getStationByIdMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};

/*****************************************************************************
* Function      : getStationByCodeMdl
* Description   : Get station by code
* Arguments     : data object with stationCode
******************************************************************************/
exports.getStationByCodeMdl = function(data) {
    const stationCode = String(data.stationCode).replace(/'/g, "''");
    const QRY_TO_EXEC = `SELECT * FROM sttn_lst_t 
        WHERE sttn_cd = '${stationCode}' 
        AND a_in = 1 
        LIMIT 1`;
    
    console.log('[getStationByCodeMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};

/*****************************************************************************
* Function      : getActiveStationsMdl
* Description   : Get all active stations
* Arguments     : data object (optional limit, offset)
******************************************************************************/
exports.getActiveStationsMdl = function(data) {
    const limit = data.limit || 100;
    const offset = data.offset || 0;
    
    const QRY_TO_EXEC = `SELECT * FROM sttn_lst_t 
        WHERE a_in = 1 
        ORDER BY sttn_nm_tx ASC 
        LIMIT ${limit} OFFSET ${offset}`;
    
    console.log('[getActiveStationsMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};

/*****************************************************************************
* Function      : searchStationsMdl
* Description   : Search stations by name, code, address, or city
* Arguments     : data object with searchTerm
******************************************************************************/
exports.searchStationsMdl = function(data) {
    const searchTerm = String(data.searchTerm).replace(/'/g, "''").replace(/\\/g, '\\\\');
    
    const QRY_TO_EXEC = `
        SELECT * FROM sttn_lst_t
        WHERE a_in = 1 
        AND (sttn_nm_tx LIKE '%${searchTerm}%' 
             OR sttn_cd LIKE '%${searchTerm}%'
             OR addr_tx LIKE '%${searchTerm}%'
             OR cty_tx LIKE '%${searchTerm}%')
        ORDER BY sttn_nm_tx
        LIMIT 20
    `;
    
    console.log('[searchStationsMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
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
            rtng_nbr = ((rtng_nbr * ttl_rtngs_nbr) + ${data.newRating}) / (ttl_rtngs_nbr + 1)
        WHERE sttn_id = ${data.stationId}
    `;
    
    console.log('[updateRatingMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};

/*****************************************************************************
* Function      : getStationConnectorsMdl
* Description   : Get connectors for a station
* Arguments     : data object with stationId
******************************************************************************/
exports.getStationConnectorsMdl = function(data) {
    const QRY_TO_EXEC = `SELECT * FROM cnntr_lst_t 
        WHERE sttn_id = ${data.stationId} 
        AND a_in = 1    
        ORDER BY cnntr_id`;
    
    console.log('[getStationConnectorsMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};

/*****************************************************************************
* Function      : getConnectorByIdMdl
* Description   : Get connector by ID
* Arguments     : data object with connectorId
******************************************************************************/
exports.getConnectorByIdMdl = function(data) {
    const QRY_TO_EXEC = `SELECT * FROM cnntr_lst_t 
        WHERE cnntr_id = ${data.connectorId} 
        AND a_in = 1 
        LIMIT 1`;
    
    console.log('[getConnectorByIdMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};

/*****************************************************************************
* Function      : getAvailableConnectorMdl
* Description   : Get available connector for a station
* Arguments     : data object with stationId, connectorType (optional)
******************************************************************************/
exports.getAvailableConnectorMdl = function(data) {
    let whereClause = `sttn_id = ${data.stationId} AND is_avlbl_in = 1 AND a_in = 1`;
    
    if (data.connectorType) {
        const connectorType = String(data.connectorType).replace(/'/g, "''");
        whereClause += ` AND cnntr_typ_cd = '${connectorType}'`;
    }
    
    const QRY_TO_EXEC = `SELECT * FROM cnntr_lst_t 
        WHERE ${whereClause} 
        LIMIT 1`;
    
    console.log('[getAvailableConnectorMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
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
        WHERE f.usr_id = ${data.userId} AND f.a_in = 1 AND s.a_in = 1
        ORDER BY f.i_ts DESC
    `;
    
    console.log('[getUserFavoritesMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
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
        (${data.userId}, ${data.stationId}, 1)`;
    
    console.log('[addFavoriteMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};

/*****************************************************************************
* Function      : removeFavoriteMdl
* Description   : Remove station from user favorites
* Arguments     : data object with userId, stationId
******************************************************************************/
exports.removeFavoriteMdl = function(data) {
    const QRY_TO_EXEC = `UPDATE fvrt_lst_t 
        SET a_in = 0 
        WHERE usr_id = ${data.userId} 
        AND sttn_id = ${data.stationId}`;
    
    console.log('[removeFavoriteMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};

/*****************************************************************************
* Function      : isFavoriteMdl
* Description   : Check if station is user favorite
* Arguments     : data object with userId, stationId
******************************************************************************/
exports.isFavoriteMdl = function(data) {
    const QRY_TO_EXEC = `SELECT * FROM fvrt_lst_t 
        WHERE usr_id = ${data.userId} 
        AND sttn_id = ${data.stationId} 
        AND a_in = 1 
        LIMIT 1`;
    
    console.log('[isFavoriteMdl] Query:', QRY_TO_EXEC);
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};

