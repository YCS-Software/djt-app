/**
 * Charging Station Controller
 * Handles charging station operations
 */

const { ChargingStation, StationConnector, UserFavoriteStation } = require('../../../../models');
const std = require(appRoot + '/utils/standardMessages');

// Dummy stations data for when database is empty - Rajahmundry, Andhra Pradesh, India
const DUMMY_STATIONS = [
    {
        station_id: 1,
        name: 'DJT HAIKA PowerHub Main Road',
        code: 'DJT001',
        address: 'Main Road, Near RTC Bus Stand',
        city: 'Rajahmundry',
        latitude: 17.0000,
        longitude: 81.7833,
        distance: '0.5',
        price_per_kwh: 10.00,
        total_chargers: 4,
        available_chargers: 3,
        rating: 4.5,
        is_fast_charging: true,
        power: '150kW',
        connector_types: ['CCS2', 'CHAdeMO']
    },
    {
        station_id: 2,
        name: 'DJT HAIKA EcoCharge Godavari',
        code: 'DJT002',
        address: 'Godavari Bund Road, Near Pushkar Ghat',
        city: 'Rajahmundry',
        latitude: 17.0080,
        longitude: 81.7900,
        distance: '1.2',
        price_per_kwh: 8.00,
        total_chargers: 6,
        available_chargers: 4,
        rating: 4.2,
        is_fast_charging: false,
        power: '22kW',
        connector_types: ['Type 2', 'CCS2']
    },
    {
        station_id: 3,
        name: 'DJT HAIKA QuickCharge Express',
        code: 'DJT003',
        address: 'NH-16, Near Katheru Junction',
        city: 'Rajahmundry',
        latitude: 16.9920,
        longitude: 81.7750,
        distance: '2.1',
        price_per_kwh: 12.00,
        total_chargers: 3,
        available_chargers: 2,
        rating: 4.7,
        is_fast_charging: true,
        power: '350kW',
        connector_types: ['CCS2', 'CHAdeMO', 'Type 2']
    }
];

/**
 * Get nearby stations
 */
exports.getNearbyStations = async (req, res) => {
    try {
        const { latitude, longitude, radius = 50 } = req.query;

        // If no coordinates provided, return dummy data
        if (!latitude || !longitude) {
            return res.status(std.message["SUCCESS"].code).json({
                status: std.message["SUCCESS"].code,
                message: std.message["SUCCESS"].message,
                data: { stations: DUMMY_STATIONS }
            });
        }

        let stationsWithConnectors = [];
        
        try {
            const stations = await ChargingStation.getNearbyStations(
                parseFloat(latitude),
                parseFloat(longitude),
                parseInt(radius)
            );

            // Get connectors for each station
            stationsWithConnectors = await Promise.all(
                stations.map(async (station) => {
                    const connectors = await StationConnector.getStationConnectors(station.sttn_id);
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
                        connector_types: connectors.map(c => c.cnntr_typ_cd)
                    };
                })
            );
        } catch (dbError) {
            console.log('[StationCtrl] Database error, returning dummy data:', dbError.message);
        }

        // Return dummy data if no stations found
        if (!stationsWithConnectors || stationsWithConnectors.length === 0) {
            stationsWithConnectors = DUMMY_STATIONS;
        }

        res.status(std.message["SUCCESS"].code).json({
            status: std.message["SUCCESS"].code,
            message: std.message["SUCCESS"].message,
            data: { stations: stationsWithConnectors }
        });
    } catch (error) {
        console.error('[StationCtrl] getNearbyStations error:', error);
        // Return dummy data on error
        res.status(std.message["SUCCESS"].code).json({
            status: std.message["SUCCESS"].code,
            message: std.message["SUCCESS"].message,
            data: { stations: DUMMY_STATIONS }
        });
    }
};

/**
 * Get all active stations
 */
exports.getAllStations = async (req, res) => {
    try {
        const stations = await ChargingStation.getActiveStations();

        const formattedStations = await Promise.all(
            stations.map(async (station) => {
                const connectors = await StationConnector.getStationConnectors(station.sttn_id);
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
                    connector_types: connectors.map(c => c.cnntr_typ_cd)
                };
            })
        );

        res.status(std.message["SUCCESS"].code).json({
            status: std.message["SUCCESS"].code,
            message: std.message["SUCCESS"].message,
            data: { stations: formattedStations }
        });
    } catch (error) {
        console.error('[StationCtrl] getAllStations error:', error);
        res.status(std.message["INTERNAL_ERROR"].code).json({
            status: std.message["INTERNAL_ERROR"].code,
            message: error.message || std.message["INTERNAL_ERROR"].message,
            data: null
        });
    }
};

/**
 * Get station details
 */
exports.getStationDetails = async (req, res) => {
    try {
        const { stationId } = req.params;

        const station = await ChargingStation.findById(stationId, 'sttn_id');
        if (!station) {
            return res.status(std.message["NOT_FOUND"].code).json({
                status: std.message["NOT_FOUND"].code,
                message: 'Station not found',
                data: null
            });
        }

        const connectors = await StationConnector.getStationConnectors(station.sttn_id);

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
            connectors: connectors.map(c => ({
                connector_id: c.cnntr_id,
                type: c.cnntr_typ_cd,
                power: c.pwr_tx,
                is_available: c.is_avlbl_in === 1
            }))
        };

        res.status(std.message["SUCCESS"].code).json({
            status: std.message["SUCCESS"].code,
            message: std.message["SUCCESS"].message,
            data: { station: stationDetails }
        });
    } catch (error) {
        console.error('[StationCtrl] getStationDetails error:', error);
        res.status(std.message["INTERNAL_ERROR"].code).json({
            status: std.message["INTERNAL_ERROR"].code,
            message: error.message || std.message["INTERNAL_ERROR"].message,
            data: null
        });
    }
};

/**
 * Search stations
 */
exports.searchStations = async (req, res) => {
    try {
        const { q } = req.query;

        if (!q || q.trim() === '') {
            return res.status(std.message["BAD_REQUEST"].code).json({
                status: std.message["BAD_REQUEST"].code,
                message: 'Search query is required',
                data: null
            });
        }

        const stations = await ChargingStation.searchStations(q.trim());

        // Handle case where stations is null or undefined
        if (!stations || !Array.isArray(stations)) {
            return res.status(std.message["SUCCESS"].code).json({
                status: std.message["SUCCESS"].code,
                message: std.message["SUCCESS"].message,
                data: { stations: [] }
            });
        }

        const formattedStations = stations.map(station => ({
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
        }));

        res.status(std.message["SUCCESS"].code).json({
            status: std.message["SUCCESS"].code,
            message: std.message["SUCCESS"].message,
            data: { stations: formattedStations }
        });
    } catch (error) {
        console.error('[StationCtrl] searchStations error:', error);
        res.status(std.message["INTERNAL_ERROR"].code).json({
            status: std.message["INTERNAL_ERROR"].code,
            message: error.message || std.message["INTERNAL_ERROR"].message,
            data: null
        });
    }
};

/**
 * Get favorite stations
 */
exports.getFavorites = async (req, res) => {
    try {
        const userId = req.user.userId;

        const favorites = await UserFavoriteStation.getUserFavorites(userId);

        const formattedFavorites = favorites.map(fav => ({
            station_id: fav.sttn_id,
            name: fav.sttn_nm_tx,
            address: fav.addr_tx,
            favorited_at: fav.favorited_at
        }));

        res.status(std.message["SUCCESS"].code).json({
            status: std.message["SUCCESS"].code,
            message: std.message["SUCCESS"].message,
            data: { favorites: formattedFavorites }
        });
    } catch (error) {
        console.error('[StationCtrl] getFavorites error:', error);
        res.status(std.message["INTERNAL_ERROR"].code).json({
            status: std.message["INTERNAL_ERROR"].code,
            message: error.message || std.message["INTERNAL_ERROR"].message,
            data: null
        });
    }
};

/**
 * Add favorite station
 */
exports.addFavorite = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { station_id } = req.body;

        if (!station_id) {
            return res.status(std.message["BAD_REQUEST"].code).json({
                status: std.message["BAD_REQUEST"].code,
                message: 'Station ID is required',
                data: null
            });
        }

        await UserFavoriteStation.addFavorite(userId, station_id);

        res.status(std.message["SUCCESS"].code).json({
            status: std.message["SUCCESS"].code,
            message: 'Station added to favorites',
            data: {}
        });
    } catch (error) {
        console.error('[StationCtrl] addFavorite error:', error);
        res.status(std.message["INTERNAL_ERROR"].code).json({
            status: std.message["INTERNAL_ERROR"].code,
            message: error.message || std.message["INTERNAL_ERROR"].message,
            data: null
        });
    }
};

/**
 * Remove favorite station
 */
exports.removeFavorite = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { stationId } = req.params;

        await UserFavoriteStation.removeFavorite(userId, parseInt(stationId));

        res.status(std.message["SUCCESS"].code).json({
            status: std.message["SUCCESS"].code,
            message: 'Station removed from favorites',
            data: {}
        });
    } catch (error) {
        console.error('[StationCtrl] removeFavorite error:', error);
        res.status(std.message["INTERNAL_ERROR"].code).json({
            status: std.message["INTERNAL_ERROR"].code,
            message: error.message || std.message["INTERNAL_ERROR"].message,
            data: null
        });
    }
};
