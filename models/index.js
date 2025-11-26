/**
 * Models Index
 * Central export for all database models
 */

const BaseModel = require('./baseModel');
const userModel = require('./userModel');
const authModel = require('./authModel');
const { Wallet, WalletTransaction } = require('./walletModel');
const { ChargingStation, StationConnector, UserFavoriteStation } = require('./stationModel');
const { ChargingSession, ChargingSessionLog } = require('./sessionModel');
const { StationBooking } = require('./bookingModel');
const { UserVehicle } = require('./vehicleModel');
const { UserStatistics } = require('./statisticsModel');

module.exports = {
    BaseModel,
    User: userModel,
    Auth: authModel,
    Wallet,
    WalletTransaction,
    ChargingStation,
    StationConnector,
    UserFavoriteStation,
    ChargingSession,
    ChargingSessionLog,
    StationBooking,
    UserVehicle,
    UserStatistics
};
