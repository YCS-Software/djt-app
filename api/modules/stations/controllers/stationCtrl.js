/**
 * Charging Station Controller
 * Handles charging station operations
 */

const stationMdl = require('../models/stationMdl');
const std = require(appRoot + '/utils/standardMessages');
const df = require(appRoot + '/utils/dateFormatUtil');
const cntxtDtls = "stationCtrl";

/**
 * Get nearby stations
 */
exports.getNearbyStations = function(req, res) {
    var fnm = "getNearbyStations";
    const { latitude, longitude, radius = 50 } = req.query;

    // If no coordinates provided, return error
    if (!latitude || !longitude) {
        return res.status(std.message["BAD_REQUEST"].code).json({
            status: std.message["BAD_REQUEST"].code,
            message: 'Latitude and longitude are required',
            data: null
        });
    }

    stationMdl.getNearbyStationsMdl({ 
        latitude: parseFloat(latitude), 
        longitude: parseFloat(longitude), 
        radius: parseInt(radius) 
    })
    .then(function(stations) {
        if (!stations || stations.length === 0) {
            return df.formatSucessRes(req, res, { stations: [] }, cntxtDtls, fnm, {});
        }

        // Get connectors for each station
        return Promise.all(
            stations.map(function(station) {
                return stationMdl.getStationConnectorsMdl({ stationId: station.sttn_id })
                    .then(function(connectors) {
                        return {
                            station_id: station.sttn_id,
                            name: station.sttn_nm_tx,
                            code: station.sttn_cd,
                            address: station.addr_tx,
                            city: station.cty_tx,
                            latitude: parseFloat(station.ltde_nbr),
                            longitude: parseFloat(station.lngtde_nbr),
                            distance: parseFloat(station.distance || 0).toFixed(2),
                            price_per_kwh: parseFloat(station.prce_per_kwh_amt),
                            total_chargers: station.ttl_chrgrs_nbr,
                            available_chargers: station.avlbl_chrgrs_nbr,
                            rating: parseFloat(station.rtng_nbr),
                            is_fast_charging: station.is_fst_chrgng_in === 1,
                            power: station.pwr_tx,
                            connector_types: connectors ? connectors.map(function(c) { return c.cnntr_typ_cd; }) : []
                        };
                    });
            })
        );
    })
    .then(function(stationsWithConnectors) {
        return df.formatSucessRes(req, res, { stations: stationsWithConnectors || [] }, cntxtDtls, fnm, {});
    })
    .catch(function(error) {
        console.error('[StationCtrl] getNearbyStations error:', error);
        return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
    });
};

/**
 * Get all active stations
 */
exports.getAllStations = function(req, res) {
    var fnm = "getAllStations";
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;

    stationMdl.getActiveStationsMdl({ limit: limit, offset: offset })
        .then(function(stations) {
            if (!stations || stations.length === 0) {
                return df.formatSucessRes(req, res, { stations: [] }, cntxtDtls, fnm, {});
            }

            // Get connectors for each station
            return Promise.all(
                stations.map(function(station) {
                    return stationMdl.getStationConnectorsMdl({ stationId: station.sttn_id })
                        .then(function(connectors) {
                            return {
                                station_id: station.sttn_id,
                                name: station.sttn_nm_tx,
                                code: station.sttn_cd,
                                address: station.addr_tx,
                                city: station.cty_tx,
                                latitude: parseFloat(station.ltde_nbr) || 17.0000,
                                longitude: parseFloat(station.lngtde_nbr) || 81.7833,
                                price_per_kwh: parseFloat(station.prce_per_kwh_amt),
                                total_chargers: station.ttl_chrgrs_nbr,
                                available_chargers: station.avlbl_chrgrs_nbr,
                                rating: parseFloat(station.rtng_nbr),
                                is_fast_charging: station.is_fst_chrgng_in === 1,
                                power: station.pwr_tx,
                                connector_types: connectors ? connectors.map(function(c) { return c.cnntr_typ_cd; }) : []
                            };
                        });
                })
            );
        })
        .then(function(formattedStations) {
            return df.formatSucessRes(req, res, { stations: formattedStations || [] }, cntxtDtls, fnm, {});
        })
        .catch(function(error) {
            console.error('[StationCtrl] getAllStations error:', error);
            return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
        });
};

/**
 * Get station details
 */
exports.getStationDetails = function(req, res) {
    var fnm = "getStationDetails";
    const { stationId } = req.params;

    if (!stationId) {
        return res.status(std.message["BAD_REQUEST"].code).json({
            status: std.message["BAD_REQUEST"].code,
            message: 'Station ID is required',
            data: null
        });
    }

    stationMdl.getStationByIdMdl({ stationId: stationId })
        .then(function(stationResults) {
            if (!stationResults || stationResults.length === 0) {
                return res.status(std.message["NOT_FOUND"].code).json({
                    status: std.message["NOT_FOUND"].code,
                    message: 'Station not found',
                    data: null
                });
            }

            const station = stationResults[0];
            return stationMdl.getStationConnectorsMdl({ stationId: station.sttn_id })
                .then(function(connectors) {
                    const stationDetails = {
                        station_id: station.sttn_id,
                        name: station.sttn_nm_tx,
                        code: station.sttn_cd,
                        address: station.addr_tx,
                        city: station.cty_tx,
                        price_per_kwh: parseFloat(station.prce_per_kwh_amt),
                        total_chargers: station.ttl_chrgrs_nbr,
                        available_chargers: station.avlbl_chrgrs_nbr,
                        rating: parseFloat(station.rtng_nbr),
                        is_fast_charging: station.is_fst_chrgng_in === 1,
                        power: station.pwr_tx,
                        operating_hours: station.oprng_hrs_json,
                        amenities: station.amnties_json,
                        connectors: connectors ? connectors.map(function(c) {
                            return {
                                connector_id: c.cnntr_id,
                                type: c.cnntr_typ_cd,
                                power: c.pwr_tx,
                                is_available: c.is_avlbl_in === 1
                            };
                        }) : []
                    };

                    return df.formatSucessRes(req, res, { station: stationDetails }, cntxtDtls, fnm, {});
                });
        })
        .catch(function(error) {
            console.error('[StationCtrl] getStationDetails error:', error);
            return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
        });
};

/**
 * Search stations
 */
exports.searchStations = function(req, res) {
    var fnm = "searchStations";
    const { q } = req.query;

    console.log('[StationCtrl] searchStations query:', q);
    if (!q || q.trim() === '') {
        return res.status(std.message["BAD_REQUEST"].code).json({
            status: std.message["BAD_REQUEST"].code,
            message: 'Search query is required',
            data: null
        });
    }

    stationMdl.searchStationsMdl({ searchTerm: q.trim() })
        .then(function(stations) {
            console.log('[StationCtrl] searchStations stations:', stations);
            if (!stations || !Array.isArray(stations)) {
                return df.formatSucessRes(req, res, { stations: [] }, cntxtDtls, fnm, {});
            }

            const formattedStations = stations.map(function(station) {
                return {
                    station_id: station.sttn_id,
                    name: station.sttn_nm_tx,
                    code: station.sttn_cd,
                    address: station.addr_tx,
                    city: station.cty_tx,
                    latitude: parseFloat(station.ltde_nbr) || 0,
                    longitude: parseFloat(station.lngtde_nbr) || 0,
                    price_per_kwh: parseFloat(station.prce_per_kwh_amt) || 0,
                    total_chargers: station.ttl_chrgrs_nbr || 0,
                    available_chargers: station.avlbl_chrgrs_nbr || 0,
                    rating: parseFloat(station.rtng_nbr) || 0,
                    is_fast_charging: station.is_fst_chrgng_in === 1,
                    power: station.pwr_tx || null
                };
            });

            return df.formatSucessRes(req, res, { stations: formattedStations }, cntxtDtls, fnm, {});
        })
        .catch(function(error) {
            console.error('[StationCtrl] searchStations error:', error);
            return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
        });
};

/**
 * Get favorite stations
 */
exports.getFavorites = function(req, res) {
    var fnm = "getFavorites";
    const userId = req.user.userId;

    stationMdl.getUserFavoritesMdl({ userId: userId })
        .then(function(favorites) {
            const formattedFavorites = favorites ? favorites.map(function(fav) {
                return {
                    station_id: fav.sttn_id,
                    name: fav.sttn_nm_tx,
                    address: fav.addr_tx,
                    favorited_at: fav.favorited_at
                };
            }) : [];

            return df.formatSucessRes(req, res, { favorites: formattedFavorites }, cntxtDtls, fnm, {});
        })
        .catch(function(error) {
            console.error('[StationCtrl] getFavorites error:', error);
            return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
        });
};

/**
 * Add favorite station
 */
exports.addFavorite = function(req, res) {
    var fnm = "addFavorite";
    const userId = req.user.userId;
    const { station_id } = req.body;

    if (!station_id) {
        return res.status(std.message["BAD_REQUEST"].code).json({
            status: std.message["BAD_REQUEST"].code,
            message: 'Station ID is required',
            data: null
        });
    }

    stationMdl.addFavoriteMdl({ userId: userId, stationId: station_id })
        .then(function() {
            return df.formatSucessRes(req, res, {}, cntxtDtls, fnm, { message: 'Station added to favorites' });
        })
        .catch(function(error) {
            console.error('[StationCtrl] addFavorite error:', error);
            return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
        });
};

/**
 * Remove favorite station
 */
exports.removeFavorite = function(req, res) {
    var fnm = "removeFavorite";
    const userId = req.user.userId;
    const { stationId } = req.params;

    if (!stationId) {
        return res.status(std.message["BAD_REQUEST"].code).json({
            status: std.message["BAD_REQUEST"].code,
            message: 'Station ID is required',
            data: null
        });
    }

    stationMdl.removeFavoriteMdl({ userId: userId, stationId: parseInt(stationId) })
        .then(function() {
            return df.formatSucessRes(req, res, {}, cntxtDtls, fnm, { message: 'Station removed from favorites' });
        })
        .catch(function(error) {
            console.error('[StationCtrl] removeFavorite error:', error);
            return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
        });
};
