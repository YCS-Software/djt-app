/**
 * Owner Controller
 * EV station owner operations: create/list stations, add machines & connectors.
 * All routes are guarded by verifyToken + isOwner.
 */

const ownerMdl = require('../models/ownerMdl');
const std = require(appRoot + '/utils/standardMessages');
const df = require(appRoot + '/utils/dateFormatUtil');
const cntxtDtls = "ownerCtrl";

// Generate a reasonably-unique station code, e.g. DJT-LZ4F9K2
function genStationCode() {
    return 'DJT-' + Date.now().toString(36).toUpperCase().slice(-6) +
        Math.floor(Math.random() * 90 + 10);
}

function badRequest(res, message) {
    return res.status(std.message["BAD_REQUEST"].code).json({
        status: std.message["BAD_REQUEST"].code, message, data: null
    });
}

function notFound(res, message) {
    return res.status(std.message["NOT_FOUND"].code).json({
        status: std.message["NOT_FOUND"].code, message, data: null
    });
}

function mapStation(s) {
    return {
        station_id: s.sttn_id,
        owner_id: s.ownr_usr_id,
        approval_status: s.aprvl_sttus_cd,
        name: s.sttn_nm_tx,
        code: s.sttn_cd,
        address: s.addr_tx,
        city: s.cty_tx,
        state: s.stte_tx,
        postal_code: s.pstl_cd_tx,
        latitude: s.ltde_nbr !== null ? parseFloat(s.ltde_nbr) : null,
        longitude: s.lngtde_nbr !== null ? parseFloat(s.lngtde_nbr) : null,
        price_per_kwh: parseFloat(s.prce_per_kwh_amt || 0),
        total_chargers: s.ttl_chrgrs_nbr || 0,
        available_chargers: s.avlbl_chrgrs_nbr || 0,
        is_fast_charging: s.is_fst_chrgng_in === 1,
        power: s.pwr_tx,
        operator_name: s.oprtr_nm_tx,
        contact_number: s.cntct_nbr_tx,
        rating: parseFloat(s.rtng_nbr || 0),
        machine_count: s.machine_count !== undefined ? Number(s.machine_count) : undefined,
        connector_count: s.connector_count !== undefined ? Number(s.connector_count) : undefined,
        created_at: s.i_ts
    };
}

function mapMachine(m) {
    return {
        machine_id: m.mchn_id,
        station_id: m.sttn_id,
        name: m.mchn_nm_tx,
        serial_no: m.mchn_srl_no_tx,
        ocpp_id: m.ocpp_id_tx,
        machine_type: m.mchn_typ_cd,
        max_power: m.max_pwr_tx,
        total_connectors: m.ttl_cnntrs_nbr,
        status: m.sttus_cd,
        created_at: m.i_ts
    };
}

function mapConnector(c) {
    return {
        connector_id: c.cnntr_id,
        station_id: c.sttn_id,
        machine_id: c.mchn_id,
        type: c.cnntr_typ_cd,
        name: c.cnntr_nm_tx,
        power: c.pwr_tx,
        is_available: c.is_avlbl_in === 1
    };
}

/*****************************************************************************
* Function      : getDashboard
* Description   : Owner summary counts
******************************************************************************/
exports.getDashboard = function(req, res) {
    const fnm = "getDashboard";
    const ownerId = req.user.userId;

    ownerMdl.getOwnerDashboardMdl({ ownerId })
        .then(function(rows) {
            const r = (rows && rows[0]) || {};
            return df.formatSucessRes(req, res, {
                total_stations: Number(r.total_stations || 0),
                total_machines: Number(r.total_machines || 0),
                total_connectors: Number(r.total_connectors || 0),
                available_machines: Number(r.available_machines || 0)
            }, cntxtDtls, fnm, {});
        })
        .catch(function(error) {
            console.error('[ownerCtrl] getDashboard error:', error);
            return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
        });
};

/*****************************************************************************
* Function      : getMyStations
******************************************************************************/
exports.getMyStations = function(req, res) {
    const fnm = "getMyStations";
    const ownerId = req.user.userId;

    ownerMdl.getStationsByOwnerMdl({ ownerId })
        .then(function(stations) {
            const list = (stations || []).map(mapStation);
            return df.formatSucessRes(req, res, { stations: list }, cntxtDtls, fnm, {});
        })
        .catch(function(error) {
            console.error('[ownerCtrl] getMyStations error:', error);
            return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
        });
};

/*****************************************************************************
* Function      : createStation
* Description   : Create a station owned by the logged-in owner.
*                 Latitude/longitude are REQUIRED (captured on the map).
******************************************************************************/
exports.createStation = function(req, res) {
    const fnm = "createStation";
    const data = req.body.data ? req.body.data : req.body;
    const ownerId = req.user.userId;

    const name = (data.name || '').trim();
    const address = (data.address || '').trim();
    const latitude = data.latitude;
    const longitude = data.longitude;

    if (!name) return badRequest(res, 'Station name is required');
    if (!address) return badRequest(res, 'Station address is required');

    // Location is mandatory — the UI shows a warning if not captured.
    if (latitude === undefined || latitude === null || latitude === '' ||
        longitude === undefined || longitude === null || longitude === '') {
        return badRequest(res, 'Please capture the station location (latitude & longitude) on the map');
    }
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return badRequest(res, 'Invalid location coordinates');
    }

    const payload = {
        ownerId,
        code: genStationCode(),
        name,
        address,
        city: data.city || null,
        state: data.state || null,
        postalCode: data.postal_code || null,
        latitude: lat,
        longitude: lng,
        pricePerKwh: data.price_per_kwh || 0,
        totalChargers: 0,
        availableChargers: 0,
        isFastCharging: !!data.is_fast_charging,
        power: data.power || null,
        operatorName: data.operator_name || null,
        contactNumber: data.contact_number || null
    };

    ownerMdl.createStationMdl(payload)
        .then(function(result) {
            if (!result || !result.insertId) {
                return res.status(std.message["INTERNAL_ERROR"].code).json({
                    status: std.message["INTERNAL_ERROR"].code,
                    message: 'Failed to create station', data: null
                });
            }
            return ownerMdl.getOwnedStationMdl({ ownerId, stationId: result.insertId })
                .then(function(rows) {
                    return df.formatSucessRes(req, res,
                        { station: rows && rows[0] ? mapStation(rows[0]) : { station_id: result.insertId } },
                        cntxtDtls, fnm, { message: 'Station created successfully' });
                });
        })
        .catch(function(error) {
            console.error('[ownerCtrl] createStation error:', error);
            return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
        });
};

/*****************************************************************************
* Function      : getStationDetail
* Description   : Owned station with its machines + connectors
******************************************************************************/
exports.getStationDetail = function(req, res) {
    const fnm = "getStationDetail";
    const ownerId = req.user.userId;
    const stationId = parseInt(req.params.stationId);

    if (!stationId) return badRequest(res, 'Station ID is required');

    ownerMdl.getOwnedStationMdl({ ownerId, stationId })
        .then(function(rows) {
            if (!rows || rows.length === 0) return notFound(res, 'Station not found');
            const station = mapStation(rows[0]);

            return ownerMdl.getMachinesByStationMdl({ stationId })
                .then(function(machines) {
                    machines = machines || [];
                    return Promise.all(machines.map(function(m) {
                        return ownerMdl.getConnectorsByMachineMdl({ machineId: m.mchn_id })
                            .then(function(conns) {
                                const machine = mapMachine(m);
                                machine.connectors = (conns || []).map(mapConnector);
                                return machine;
                            });
                    }));
                })
                .then(function(machinesWithConns) {
                    station.machines = machinesWithConns;
                    return df.formatSucessRes(req, res, { station }, cntxtDtls, fnm, {});
                });
        })
        .catch(function(error) {
            console.error('[ownerCtrl] getStationDetail error:', error);
            return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
        });
};

/*****************************************************************************
* Function      : updateStation
******************************************************************************/
exports.updateStation = function(req, res) {
    const fnm = "updateStation";
    const data = req.body.data ? req.body.data : req.body;
    const ownerId = req.user.userId;
    const stationId = parseInt(req.params.stationId);

    if (!stationId) return badRequest(res, 'Station ID is required');

    ownerMdl.getOwnedStationMdl({ ownerId, stationId })
        .then(function(rows) {
            if (!rows || rows.length === 0) return notFound(res, 'Station not found');
            return ownerMdl.updateStationMdl({
                ownerId, stationId,
                name: data.name, address: data.address, city: data.city, state: data.state,
                latitude: data.latitude, longitude: data.longitude,
                pricePerKwh: data.price_per_kwh, isFastCharging: data.is_fast_charging,
                power: data.power, operatorName: data.operator_name, contactNumber: data.contact_number
            }).then(function() {
                return ownerMdl.getOwnedStationMdl({ ownerId, stationId })
                    .then(function(updated) {
                        return df.formatSucessRes(req, res, { station: mapStation(updated[0]) },
                            cntxtDtls, fnm, { message: 'Station updated' });
                    });
            });
        })
        .catch(function(error) {
            console.error('[ownerCtrl] updateStation error:', error);
            return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
        });
};

/*****************************************************************************
* Function      : getStationMachines
******************************************************************************/
exports.getStationMachines = function(req, res) {
    const fnm = "getStationMachines";
    const ownerId = req.user.userId;
    const stationId = parseInt(req.params.stationId);

    if (!stationId) return badRequest(res, 'Station ID is required');

    ownerMdl.getOwnedStationMdl({ ownerId, stationId })
        .then(function(rows) {
            if (!rows || rows.length === 0) return notFound(res, 'Station not found');
            return ownerMdl.getMachinesByStationMdl({ stationId })
                .then(function(machines) {
                    machines = machines || [];
                    return Promise.all(machines.map(function(m) {
                        return ownerMdl.getConnectorsByMachineMdl({ machineId: m.mchn_id })
                            .then(function(conns) {
                                const machine = mapMachine(m);
                                machine.connectors = (conns || []).map(mapConnector);
                                return machine;
                            });
                    }));
                })
                .then(function(list) {
                    return df.formatSucessRes(req, res, { machines: list }, cntxtDtls, fnm, {});
                });
        })
        .catch(function(error) {
            console.error('[ownerCtrl] getStationMachines error:', error);
            return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
        });
};

/*****************************************************************************
* Function      : addMachine
* Description   : Add a charging machine (charger) to an owned station
******************************************************************************/
exports.addMachine = function(req, res) {
    const fnm = "addMachine";
    const data = req.body.data ? req.body.data : req.body;
    const ownerId = req.user.userId;
    const stationId = parseInt(req.params.stationId);

    if (!stationId) return badRequest(res, 'Station ID is required');
    const name = (data.name || '').trim();
    if (!name) return badRequest(res, 'Machine name is required');

    ownerMdl.getOwnedStationMdl({ ownerId, stationId })
        .then(function(rows) {
            if (!rows || rows.length === 0) return notFound(res, 'Station not found');
            return ownerMdl.createMachineMdl({
                stationId,
                name,
                serialNo: data.serial_no || null,
                ocppId: data.ocpp_id || null,
                machineType: data.machine_type || 'DC',
                maxPower: data.max_power || null,
                totalConnectors: data.total_connectors || 1,
                status: data.status || 'available'
            }).then(function(result) {
                // refresh station counters after inventory change
                return ownerMdl.recalcStationCountersMdl({ stationId })
                    .then(function() {
                        return df.formatSucessRes(req, res,
                            { machine_id: result.insertId },
                            cntxtDtls, fnm, { message: 'Machine added' });
                    });
            });
        })
        .catch(function(error) {
            console.error('[ownerCtrl] addMachine error:', error);
            return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
        });
};

/*****************************************************************************
* Function      : updateMachine
******************************************************************************/
exports.updateMachine = function(req, res) {
    const fnm = "updateMachine";
    const data = req.body.data ? req.body.data : req.body;
    const ownerId = req.user.userId;
    const machineId = parseInt(req.params.machineId);

    if (!machineId) return badRequest(res, 'Machine ID is required');

    ownerMdl.getOwnedMachineMdl({ ownerId, machineId })
        .then(function(rows) {
            if (!rows || rows.length === 0) return notFound(res, 'Machine not found');
            const stationId = rows[0].sttn_id;
            return ownerMdl.updateMachineMdl({
                machineId,
                name: data.name, serialNo: data.serial_no, ocppId: data.ocpp_id,
                machineType: data.machine_type, maxPower: data.max_power, status: data.status
            }).then(function() {
                return ownerMdl.recalcStationCountersMdl({ stationId })
                    .then(function() {
                        return df.formatSucessRes(req, res, {}, cntxtDtls, fnm, { message: 'Machine updated' });
                    });
            });
        })
        .catch(function(error) {
            console.error('[ownerCtrl] updateMachine error:', error);
            return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
        });
};

/*****************************************************************************
* Function      : addConnector
* Description   : Add a connector (port) to an owned machine
******************************************************************************/
exports.addConnector = function(req, res) {
    const fnm = "addConnector";
    const data = req.body.data ? req.body.data : req.body;
    const ownerId = req.user.userId;
    const machineId = parseInt(req.params.machineId);

    if (!machineId) return badRequest(res, 'Machine ID is required');
    const connectorType = (data.connector_type || data.type || '').trim();
    if (!connectorType) return badRequest(res, 'Connector type is required');

    ownerMdl.getOwnedMachineMdl({ ownerId, machineId })
        .then(function(rows) {
            if (!rows || rows.length === 0) return notFound(res, 'Machine not found');
            const stationId = rows[0].sttn_id;
            return ownerMdl.createConnectorMdl({
                stationId,
                machineId,
                connectorType,
                name: data.name || connectorType,
                power: data.power || rows[0].max_pwr_tx || null
            }).then(function(result) {
                return df.formatSucessRes(req, res,
                    { connector_id: result.insertId },
                    cntxtDtls, fnm, { message: 'Connector added' });
            });
        })
        .catch(function(error) {
            console.error('[ownerCtrl] addConnector error:', error);
            return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
        });
};
