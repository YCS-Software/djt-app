-- ============================================
-- SAMPLE CHARGING SESSIONS INSERT
-- Based on dashboardCtrl.js DUMMY_SESSIONS data
-- ============================================

-- Prerequisites:
-- 1. At least one user must exist in users_t (assumes usr_id = 1)
-- 2. Stations must exist (assumes sttn_id 1, 2, 3 from schema.sql)
-- 3. Connectors must exist (see connector inserts below)

-- First, insert sample connectors if they don't exist
-- (These will be created automatically if stations exist)
INSERT IGNORE INTO station_connectors_t (sttn_id, cnntr_typ_cd, cnntr_nm_tx, pwr_tx, is_avlbl_in) VALUES
(1, 'CCS2', 'CCS2 Connector 1', '150kW', 1),
(1, 'CHAdeMO', 'CHAdeMO Connector 1', '150kW', 1),
(2, 'Type2', 'Type 2 Connector 1', '22kW', 1),
(2, 'CCS2', 'CCS2 Connector 1', '22kW', 1),
(3, 'CCS2', 'CCS2 Connector 1', '350kW', 1),
(3, 'CHAdeMO', 'CHAdeMO Connector 1', '350kW', 1);

-- Insert sample charging sessions
-- Session 1: DJT HAIKA PowerHub Main Road
-- Date: 1 day ago, Duration: 45 minutes, Energy: 15.5 kWh, Cost: 155.00
INSERT INTO charging_sessions_t (
    sssn_cd, usr_id, sttn_id, cnntr_id,
    strt_ts, end_ts, durn_mnts_nbr,
    enrgy_cnsmd_kwh, prce_per_kwh_amt, ttl_cst_amt,
    prgrss_pct, sttus_cd, pymnt_sttus_cd, a_in
) VALUES (
    'SSN001', 
    1,  -- User ID (assumes user exists)
    1,  -- Station ID: DJT HAIKA PowerHub Main Road
    1,  -- Connector ID: CCS2 Connector 1
    DATE_SUB(NOW(), INTERVAL 1 DAY) + INTERVAL 10 HOUR,  -- Start: 1 day ago at 10:00 AM
    DATE_SUB(NOW(), INTERVAL 1 DAY) + INTERVAL 10 HOUR + INTERVAL 45 MINUTE,  -- End: 10:45 AM
    45,  -- Duration: 45 minutes
    15.500,  -- Energy consumed: 15.5 kWh
    10.00,  -- Price per kWh: ₹10.00
    155.00,  -- Total cost: ₹155.00
    100,  -- Progress: 100% (completed)
    'completed',  -- Status: completed
    'paid',  -- Payment status: paid
    1  -- Active: yes
);

-- Session 2: DJT HAIKA EcoCharge Godavari
-- Date: 3 days ago, Duration: 60 minutes, Energy: 22.3 kWh, Cost: 178.40
INSERT INTO charging_sessions_t (
    sssn_cd, usr_id, sttn_id, cnntr_id,
    strt_ts, end_ts, durn_mnts_nbr,
    enrgy_cnsmd_kwh, prce_per_kwh_amt, ttl_cst_amt,
    prgrss_pct, sttus_cd, pymnt_sttus_cd, a_in
) VALUES (
    'SSN002',
    1,  -- User ID
    2,  -- Station ID: DJT HAIKA EcoCharge Godavari
    3,  -- Connector ID: Type 2 Connector 1
    DATE_SUB(NOW(), INTERVAL 3 DAY) + INTERVAL 14 HOUR,  -- Start: 3 days ago at 2:00 PM
    DATE_SUB(NOW(), INTERVAL 3 DAY) + INTERVAL 14 HOUR + INTERVAL 60 MINUTE,  -- End: 3:00 PM
    60,  -- Duration: 60 minutes
    22.300,  -- Energy consumed: 22.3 kWh
    8.00,  -- Price per kWh: ₹8.00
    178.40,  -- Total cost: ₹178.40
    100,  -- Progress: 100%
    'completed',
    'paid',
    1
);

-- Session 3: DJT HAIKA QuickCharge Express
-- Date: 7 days ago, Duration: 30 minutes, Energy: 18.0 kWh, Cost: 216.00
INSERT INTO charging_sessions_t (
    sssn_cd, usr_id, sttn_id, cnntr_id,
    strt_ts, end_ts, durn_mnts_nbr,
    enrgy_cnsmd_kwh, prce_per_kwh_amt, ttl_cst_amt,
    prgrss_pct, sttus_cd, pymnt_sttus_cd, a_in
) VALUES (
    'SSN003',
    1,  -- User ID
    3,  -- Station ID: DJT HAIKA QuickCharge Express
    5,  -- Connector ID: CCS2 Connector 1
    DATE_SUB(NOW(), INTERVAL 7 DAY) + INTERVAL 9 HOUR,  -- Start: 7 days ago at 9:00 AM
    DATE_SUB(NOW(), INTERVAL 7 DAY) + INTERVAL 9 HOUR + INTERVAL 30 MINUTE,  -- End: 9:30 AM
    30,  -- Duration: 30 minutes
    18.000,  -- Energy consumed: 18.0 kWh
    12.00,  -- Price per kWh: ₹12.00
    216.00,  -- Total cost: ₹216.00
    100,  -- Progress: 100%
    'completed',
    'paid',
    1
);

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- View all inserted sessions
SELECT 
    sssn_id,
    sssn_cd,
    usr_id,
    sttn_id,
    cnntr_id,
    strt_ts,
    end_ts,
    durn_mnts_nbr,
    enrgy_cnsmd_kwh,
    prce_per_kwh_amt,
    ttl_cst_amt,
    sttus_cd,
    pymnt_sttus_cd
FROM charging_sessions_t
WHERE sssn_cd IN ('SSN001', 'SSN002', 'SSN003')
ORDER BY strt_ts DESC;

-- View sessions with station names
SELECT 
    s.sssn_cd,
    s.strt_ts,
    s.end_ts,
    s.durn_mnts_nbr AS duration_minutes,
    s.enrgy_cnsmd_kwh AS energy_kwh,
    s.ttl_cst_amt AS total_cost,
    st.sttn_nm_tx AS station_name,
    st.sttn_cd AS station_code
FROM charging_sessions_t s
JOIN charging_stations_t st ON s.sttn_id = st.sttn_id
WHERE s.sssn_cd IN ('SSN001', 'SSN002', 'SSN003')
ORDER BY s.strt_ts DESC;


