-- ============================================
-- DUMMY DATA FOR station_connectors_t TABLE
-- ============================================
-- This file contains sample connector data for charging stations
-- Make sure the stations exist in charging_stations_t before running this
-- ============================================

-- Connectors for Station 1: DJT HAIKA PowerHub Main Road (DJT001)
-- Fast charging station with 150kW power
INSERT INTO station_connectors_t (sttn_id, cnntr_typ_cd, cnntr_nm_tx, pwr_tx, is_avlbl_in, a_in) VALUES
(1, 'CCS2', 'CCS2 Connector 1', '150kW', 1, 1),
(1, 'CCS2', 'CCS2 Connector 2', '150kW', 1, 1),
(1, 'CHAdeMO', 'CHAdeMO Connector 1', '150kW', 1, 1),
(1, 'Type2', 'Type 2 Connector 1', '22kW', 0, 1); -- Currently in use

-- Connectors for Station 2: DJT HAIKA EcoCharge Godavari (DJT002)
-- Standard charging station with 22kW power
INSERT INTO station_connectors_t (sttn_id, cnntr_typ_cd, cnntr_nm_tx, pwr_tx, is_avlbl_in, a_in) VALUES
(2, 'Type2', 'Type 2 Connector 1', '22kW', 1, 1),
(2, 'Type2', 'Type 2 Connector 2', '22kW', 1, 1),
(2, 'CCS2', 'CCS2 Connector 1', '22kW', 1, 1),
(2, 'CCS2', 'CCS2 Connector 2', '22kW', 0, 1), -- Currently in use
(2, 'Type2', 'Type 2 Connector 3', '22kW', 1, 1),
(2, 'Type2', 'Type 2 Connector 4', '22kW', 1, 1);

-- Connectors for Station 3: DJT HAIKA QuickCharge Express (DJT003)
-- Ultra-fast charging station with 350kW power
INSERT INTO station_connectors_t (sttn_id, cnntr_typ_cd, cnntr_nm_tx, pwr_tx, is_avlbl_in, a_in) VALUES
(3, 'CCS2', 'CCS2 Connector 1', '350kW', 1, 1),
(3, 'CCS2', 'CCS2 Connector 2', '350kW', 0, 1), -- Currently in use
(3, 'CHAdeMO', 'CHAdeMO Connector 1', '350kW', 1, 1);

-- ============================================
-- ADDITIONAL CONNECTORS FOR MORE STATIONS
-- ============================================

-- If you have more stations (4, 5, 6, etc.), you can add connectors like this:

-- Example for Station 4 (if exists)
-- INSERT INTO station_connectors_t (sttn_id, cnntr_typ_cd, cnntr_nm_tx, pwr_tx, is_avlbl_in, a_in) VALUES
-- (4, 'CCS2', 'CCS2 Connector 1', '50kW', 1, 1),
-- (4, 'Type2', 'Type 2 Connector 1', '22kW', 1, 1);

-- Example for Station 5 (if exists)
-- INSERT INTO station_connectors_t (sttn_id, cnntr_typ_cd, cnntr_nm_tx, pwr_tx, is_avlbl_in, a_in) VALUES
-- (5, 'CCS2', 'CCS2 Connector 1', '100kW', 1, 1),
-- (5, 'CHAdeMO', 'CHAdeMO Connector 1', '100kW', 1, 1),
-- (5, 'Type2', 'Type 2 Connector 1', '22kW', 1, 1);

-- ============================================
-- NOTES:
-- ============================================
-- 1. sttn_id: Must reference an existing station in charging_stations_t
-- 2. cnntr_typ_cd: Common types are:
--    - 'CCS2' (Combined Charging System 2)
--    - 'CHAdeMO' (CHArge de MOve)
--    - 'Type2' (Type 2 AC connector)
--    - 'Type1' (Type 1 AC connector, less common)
--    - 'GB/T' (Chinese standard, if applicable)
-- 3. cnntr_nm_tx: Descriptive name for the connector
-- 4. pwr_tx: Power rating (e.g., '22kW', '50kW', '150kW', '350kW')
-- 5. is_avlbl_in: 1 = Available, 0 = Currently in use/maintenance
-- 6. a_in: 1 = Active, 0 = Deleted/Inactive
-- ============================================

