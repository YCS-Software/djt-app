-- ============================================
-- EV CHARGING STATION - DATABASE SCHEMA
-- Complete database structure for EV charging application
-- ============================================

-- ============================================
-- 1. USERS & AUTHENTICATION TABLES
-- ============================================

-- Users table
CREATE TABLE users_t (
    usr_id INT PRIMARY KEY AUTO_INCREMENT,
    phn_nmbr_tx VARCHAR(15) NOT NULL UNIQUE,
    eml_tx VARCHAR(100) UNIQUE,
    nm_tx VARCHAR(100),
    prfl_img_tx VARCHAR(255),
    usr_typ_cd VARCHAR(20) DEFAULT 'customer' COMMENT 'customer, admin, operator',
    a_in TINYINT(1) DEFAULT 1 COMMENT 'Active indicator: 1=active, 0=inactive',
    i_ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Insert timestamp',
    u_ts TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP COMMENT 'Update timestamp',
    d_ts TIMESTAMP NULL COMMENT 'Delete timestamp',
    insrt_usr_id INT DEFAULT 1,
    updte_usr_id INT NULL,
    INDEX idx_phone (phn_nmbr_tx),
    INDEX idx_email (eml_tx),
    INDEX idx_active (a_in)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='User information table';

-- OTP Authentication table
CREATE TABLE auth_otp_t (
    otp_id INT PRIMARY KEY AUTO_INCREMENT,
    phn_nmbr_tx VARCHAR(15) NOT NULL,
    otp_tx VARCHAR(6) NOT NULL,
    expry_ts TIMESTAMP NOT NULL COMMENT 'OTP expiry timestamp',
    attmpts_nbr INT DEFAULT 0 COMMENT 'Number of verification attempts',
    is_vrfd_in TINYINT(1) DEFAULT 0 COMMENT 'Is verified: 1=yes, 0=no',
    vrfd_ts TIMESTAMP NULL COMMENT 'Verified timestamp',
    a_in TINYINT(1) DEFAULT 1,
    i_ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_phone (phn_nmbr_tx),
    INDEX idx_expiry (expry_ts),
    INDEX idx_verified (is_vrfd_in)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='OTP authentication records';

-- User tokens for JWT management
CREATE TABLE user_tokens_t (
    tkn_id INT PRIMARY KEY AUTO_INCREMENT,
    usr_id INT NOT NULL,
    tkn_tx TEXT NOT NULL,
    tkn_typ_cd VARCHAR(20) DEFAULT 'access' COMMENT 'access, refresh',
    expry_ts TIMESTAMP NOT NULL,
    is_rvkd_in TINYINT(1) DEFAULT 0 COMMENT 'Is revoked',
    a_in TINYINT(1) DEFAULT 1,
    i_ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usr_id) REFERENCES users_t(usr_id) ON DELETE CASCADE,
    INDEX idx_user (usr_id),
    INDEX idx_expiry (expry_ts)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='User authentication tokens';

-- ============================================
-- 2. WALLET & TRANSACTIONS TABLES
-- ============================================

-- Wallet table
CREATE TABLE wallet_t (
    wllt_id INT PRIMARY KEY AUTO_INCREMENT,
    usr_id INT NOT NULL UNIQUE,
    blnce_amt DECIMAL(10,2) DEFAULT 0.00 COMMENT 'Current balance',
    lst_updtd_ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    a_in TINYINT(1) DEFAULT 1,
    i_ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    u_ts TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (usr_id) REFERENCES users_t(usr_id) ON DELETE CASCADE,
    INDEX idx_user (usr_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='User wallet balances';

-- Wallet transactions table
CREATE TABLE wallet_transactions_t (
    trxn_id INT PRIMARY KEY AUTO_INCREMENT,
    wllt_id INT NOT NULL,
    usr_id INT NOT NULL,
    trxn_typ_cd VARCHAR(20) NOT NULL COMMENT 'credit, debit, refund',
    trxn_ctgry_cd VARCHAR(30) NOT NULL COMMENT 'charging, topup, transfer, refund',
    amt DECIMAL(10,2) NOT NULL,
    blnce_bfr_amt DECIMAL(10,2) NOT NULL COMMENT 'Balance before transaction',
    blnce_aftr_amt DECIMAL(10,2) NOT NULL COMMENT 'Balance after transaction',
    dscrptn_tx TEXT,
    ref_id VARCHAR(100) COMMENT 'Reference ID (session_id, payment_id, etc)',
    ref_typ_cd VARCHAR(30) COMMENT 'session, payment, transfer',
    pymnt_mthd_cd VARCHAR(30) COMMENT 'upi, card, netbanking',
    pymnt_dtls_json JSON COMMENT 'Payment details',
    sttus_cd VARCHAR(20) DEFAULT 'completed' COMMENT 'pending, completed, failed',
    a_in TINYINT(1) DEFAULT 1,
    i_ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (wllt_id) REFERENCES wallet_t(wllt_id) ON DELETE CASCADE,
    FOREIGN KEY (usr_id) REFERENCES users_t(usr_id) ON DELETE CASCADE,
    INDEX idx_wallet (wllt_id),
    INDEX idx_user (usr_id),
    INDEX idx_type (trxn_typ_cd),
    INDEX idx_category (trxn_ctgry_cd),
    INDEX idx_date (i_ts)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Wallet transaction history';

-- ============================================
-- 3. CHARGING STATIONS TABLES
-- ============================================

-- Charging stations table
CREATE TABLE charging_stations_t (
    sttn_id INT PRIMARY KEY AUTO_INCREMENT,
    sttn_nm_tx VARCHAR(200) NOT NULL COMMENT 'Station name',
    sttn_cd VARCHAR(50) UNIQUE NOT NULL COMMENT 'Unique station code',
    addr_tx TEXT NOT NULL,
    cty_tx VARCHAR(100),
    stte_tx VARCHAR(100),
    pstl_cd_tx VARCHAR(10),
    ltde_nbr DECIMAL(10,8) COMMENT 'Latitude',
    lngtde_nbr DECIMAL(11,8) COMMENT 'Longitude',
    prce_per_kwh_amt DECIMAL(8,2) NOT NULL COMMENT 'Price per kWh',
    ttl_chrgrs_nbr INT DEFAULT 1 COMMENT 'Total number of chargers',
    avlbl_chrgrs_nbr INT DEFAULT 1 COMMENT 'Available chargers',
    rtng_nbr DECIMAL(3,2) DEFAULT 0.00 COMMENT 'Average rating',
    ttl_rtngs_nbr INT DEFAULT 0 COMMENT 'Total ratings count',
    is_fst_chrgng_in TINYINT(1) DEFAULT 0 COMMENT 'Fast charging available',
    pwr_tx VARCHAR(20) COMMENT '150kW, 22kW, etc',
    oprtr_nm_tx VARCHAR(100),
    cntct_nbr_tx VARCHAR(15),
    oprng_hrs_json JSON COMMENT 'Operating hours',
    amnties_json JSON COMMENT 'Amenities available',
    a_in TINYINT(1) DEFAULT 1,
    i_ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    u_ts TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_code (sttn_cd),
    INDEX idx_location (ltde_nbr, lngtde_nbr),
    INDEX idx_city (cty_tx),
    INDEX idx_active (a_in)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Charging station information';

-- Charging station connectors
CREATE TABLE station_connectors_t (
    cnntr_id INT PRIMARY KEY AUTO_INCREMENT,
    sttn_id INT NOT NULL,
    cnntr_typ_cd VARCHAR(30) NOT NULL COMMENT 'CCS2, CHAdeMO, Type2',
    cnntr_nm_tx VARCHAR(50),
    pwr_tx VARCHAR(20) COMMENT 'Power rating',
    is_avlbl_in TINYINT(1) DEFAULT 1,
    a_in TINYINT(1) DEFAULT 1,
    i_ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sttn_id) REFERENCES charging_stations_t(sttn_id) ON DELETE CASCADE,
    INDEX idx_station (sttn_id),
    INDEX idx_type (cnntr_typ_cd)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Station connector types';

-- User favorite stations
CREATE TABLE user_favorite_stations_t (
    fvrt_id INT PRIMARY KEY AUTO_INCREMENT,
    usr_id INT NOT NULL,
    sttn_id INT NOT NULL,
    a_in TINYINT(1) DEFAULT 1,
    i_ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usr_id) REFERENCES users_t(usr_id) ON DELETE CASCADE,
    FOREIGN KEY (sttn_id) REFERENCES charging_stations_t(sttn_id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_station (usr_id, sttn_id),
    INDEX idx_user (usr_id),
    INDEX idx_station (sttn_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='User favorite charging stations';

-- ============================================
-- 4. CHARGING SESSIONS TABLES
-- ============================================

-- Charging sessions table
CREATE TABLE charging_sessions_t (
    sssn_id INT PRIMARY KEY AUTO_INCREMENT,
    sssn_cd VARCHAR(50) UNIQUE NOT NULL COMMENT 'Unique session code',
    usr_id INT NOT NULL,
    sttn_id INT NOT NULL,
    cnntr_id INT NOT NULL,
    strt_ts TIMESTAMP NULL COMMENT 'Session start time',
    end_ts TIMESTAMP NULL COMMENT 'Session end time',
    durn_mnts_nbr INT COMMENT 'Duration in minutes',
    enrgy_cnsmd_kwh DECIMAL(10,3) DEFAULT 0 COMMENT 'Energy consumed in kWh',
    prce_per_kwh_amt DECIMAL(8,2) COMMENT 'Price per kWh',
    ttl_cst_amt DECIMAL(10,2) DEFAULT 0 COMMENT 'Total cost',
    prgrss_pct INT DEFAULT 0 COMMENT 'Charging progress percentage',
    sttus_cd VARCHAR(20) DEFAULT 'initiated' COMMENT 'initiated, active, completed, cancelled, failed',
    pymnt_sttus_cd VARCHAR(20) DEFAULT 'pending' COMMENT 'pending, paid, refunded',
    wllt_trxn_id INT NULL COMMENT 'Reference to wallet transaction',
    qr_cd_tx VARCHAR(100) COMMENT 'QR code scanned',
    a_in TINYINT(1) DEFAULT 1,
    i_ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    u_ts TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (usr_id) REFERENCES users_t(usr_id) ON DELETE CASCADE,
    FOREIGN KEY (sttn_id) REFERENCES charging_stations_t(sttn_id) ON DELETE CASCADE,
    FOREIGN KEY (cnntr_id) REFERENCES station_connectors_t(cnntr_id),
    FOREIGN KEY (wllt_trxn_id) REFERENCES wallet_transactions_t(trxn_id),
    INDEX idx_user (usr_id),
    INDEX idx_station (sttn_id),
    INDEX idx_status (sttus_cd),
    INDEX idx_date (i_ts),
    INDEX idx_session_code (sssn_cd)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Charging session records';

-- Charging session logs (real-time updates)
CREATE TABLE charging_session_logs_t (
    log_id INT PRIMARY KEY AUTO_INCREMENT,
    sssn_id INT NOT NULL,
    prgrss_pct INT DEFAULT 0,
    enrgy_cnsmd_kwh DECIMAL(10,3),
    crnt_cst_amt DECIMAL(10,2),
    bttry_lvl_pct INT COMMENT 'Battery level percentage',
    log_ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sssn_id) REFERENCES charging_sessions_t(sssn_id) ON DELETE CASCADE,
    INDEX idx_session (sssn_id),
    INDEX idx_timestamp (log_ts)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Real-time charging session logs';

-- ============================================
-- 5. BOOKINGS TABLES
-- ============================================

-- Station bookings table
CREATE TABLE station_bookings_t (
    bkng_id INT PRIMARY KEY AUTO_INCREMENT,
    bkng_cd VARCHAR(50) UNIQUE NOT NULL,
    usr_id INT NOT NULL,
    sttn_id INT NOT NULL,
    cnntr_id INT NULL,
    bkng_dte DATE NOT NULL,
    bkng_tm TIME NOT NULL,
    durn_mnts_nbr INT NOT NULL COMMENT 'Booking duration in minutes',
    sttus_cd VARCHAR(20) DEFAULT 'confirmed' COMMENT 'confirmed, cancelled, completed, expired',
    cncltn_rsn_tx TEXT,
    cnclld_ts TIMESTAMP NULL,
    a_in TINYINT(1) DEFAULT 1,
    i_ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    u_ts TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (usr_id) REFERENCES users_t(usr_id) ON DELETE CASCADE,
    FOREIGN KEY (sttn_id) REFERENCES charging_stations_t(sttn_id) ON DELETE CASCADE,
    FOREIGN KEY (cnntr_id) REFERENCES station_connectors_t(cnntr_id),
    INDEX idx_user (usr_id),
    INDEX idx_station (sttn_id),
    INDEX idx_date (bkng_dte),
    INDEX idx_status (sttus_cd)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Station booking reservations';

-- ============================================
-- 6. USER VEHICLES TABLES
-- ============================================

-- User vehicles table
CREATE TABLE user_vehicles_t (
    vhcl_id INT PRIMARY KEY AUTO_INCREMENT,
    usr_id INT NOT NULL,
    vhcl_nm_tx VARCHAR(100) COMMENT 'Vehicle name/alias',
    mke_tx VARCHAR(50) COMMENT 'Make (Tesla, Tata, etc)',
    mdl_tx VARCHAR(50) COMMENT 'Model',
    yr_nbr INT COMMENT 'Year',
    rg_nbr_tx VARCHAR(20) COMMENT 'Registration number',
    bttry_cpcty_kwh DECIMAL(8,2) COMMENT 'Battery capacity in kWh',
    cnntr_typ_cd VARCHAR(30) COMMENT 'Compatible connector type',
    is_dflt_in TINYINT(1) DEFAULT 0 COMMENT 'Is default vehicle',
    a_in TINYINT(1) DEFAULT 1,
    i_ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    u_ts TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (usr_id) REFERENCES users_t(usr_id) ON DELETE CASCADE,
    INDEX idx_user (usr_id),
    INDEX idx_default (is_dflt_in)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='User vehicle information';

-- ============================================
-- 7. RATINGS & REVIEWS TABLES
-- ============================================

-- Station ratings and reviews
CREATE TABLE station_reviews_t (
    rvw_id INT PRIMARY KEY AUTO_INCREMENT,
    usr_id INT NOT NULL,
    sttn_id INT NOT NULL,
    sssn_id INT NULL,
    rtng_nbr INT NOT NULL COMMENT 'Rating 1-5',
    rvw_tx TEXT,
    a_in TINYINT(1) DEFAULT 1,
    i_ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    u_ts TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (usr_id) REFERENCES users_t(usr_id) ON DELETE CASCADE,
    FOREIGN KEY (sttn_id) REFERENCES charging_stations_t(sttn_id) ON DELETE CASCADE,
    FOREIGN KEY (sssn_id) REFERENCES charging_sessions_t(sssn_id) ON DELETE SET NULL,
    INDEX idx_user (usr_id),
    INDEX idx_station (sttn_id),
    INDEX idx_rating (rtng_nbr)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Station ratings and reviews';

-- ============================================
-- 8. NOTIFICATIONS TABLES
-- ============================================

-- User notifications
CREATE TABLE notifications_t (
    ntfctn_id INT PRIMARY KEY AUTO_INCREMENT,
    usr_id INT NOT NULL,
    ttl_tx VARCHAR(200) NOT NULL,
    msg_tx TEXT NOT NULL,
    typ_cd VARCHAR(30) COMMENT 'session, wallet, booking, system',
    ref_id INT NULL COMMENT 'Reference ID (session_id, booking_id, etc)',
    ref_typ_cd VARCHAR(30),
    is_rd_in TINYINT(1) DEFAULT 0 COMMENT 'Is read',
    rd_ts TIMESTAMP NULL,
    a_in TINYINT(1) DEFAULT 1,
    i_ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usr_id) REFERENCES users_t(usr_id) ON DELETE CASCADE,
    INDEX idx_user (usr_id),
    INDEX idx_read (is_rd_in),
    INDEX idx_date (i_ts)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='User notifications';

-- ============================================
-- 9. OFFERS & REWARDS TABLES
-- ============================================

-- Offers table
CREATE TABLE offers_t (
    offr_id INT PRIMARY KEY AUTO_INCREMENT,
    offr_cd VARCHAR(50) UNIQUE NOT NULL,
    ttl_tx VARCHAR(200) NOT NULL,
    dscrptn_tx TEXT,
    dscnt_typ_cd VARCHAR(20) COMMENT 'percentage, flat',
    dscnt_vl DECIMAL(10,2),
    mx_dscnt_amt DECIMAL(10,2),
    mn_trxn_amt DECIMAL(10,2),
    strt_dte DATE,
    end_dte DATE,
    mx_uses_nbr INT COMMENT 'Max uses per user',
    a_in TINYINT(1) DEFAULT 1,
    i_ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    u_ts TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_code (offr_cd),
    INDEX idx_dates (strt_dte, end_dte)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Promotional offers';

-- User offer usage
CREATE TABLE user_offer_usage_t (
    usg_id INT PRIMARY KEY AUTO_INCREMENT,
    usr_id INT NOT NULL,
    offr_id INT NOT NULL,
    sssn_id INT NULL,
    dscnt_amt DECIMAL(10,2),
    i_ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usr_id) REFERENCES users_t(usr_id) ON DELETE CASCADE,
    FOREIGN KEY (offr_id) REFERENCES offers_t(offr_id) ON DELETE CASCADE,
    FOREIGN KEY (sssn_id) REFERENCES charging_sessions_t(sssn_id),
    INDEX idx_user (usr_id),
    INDEX idx_offer (offr_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='User offer usage tracking';

-- ============================================
-- 10. STATISTICS & ANALYTICS TABLES
-- ============================================

-- User statistics (cached/aggregated data)
CREATE TABLE user_statistics_t (
    stt_id INT PRIMARY KEY AUTO_INCREMENT,
    usr_id INT NOT NULL UNIQUE,
    ttl_sssns_nbr INT DEFAULT 0,
    ttl_enrgy_kwh DECIMAL(12,3) DEFAULT 0,
    ttl_spnt_amt DECIMAL(12,2) DEFAULT 0,
    co2_svd_kg DECIMAL(10,2) DEFAULT 0,
    avg_sssn_durn_mnts INT DEFAULT 0,
    avg_sssn_cst_amt DECIMAL(10,2) DEFAULT 0,
    lst_updtd_ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (usr_id) REFERENCES users_t(usr_id) ON DELETE CASCADE,
    INDEX idx_user (usr_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='User aggregated statistics';

-- ============================================
-- 11. AUDIT & LOGS TABLES
-- ============================================

-- Audit log table
CREATE TABLE audit_logs_t (
    log_id INT PRIMARY KEY AUTO_INCREMENT,
    usr_id INT NULL,
    actn_cd VARCHAR(50) NOT NULL COMMENT 'login, logout, payment, session_start, etc',
    entty_typ_cd VARCHAR(50) COMMENT 'user, session, wallet, etc',
    entty_id INT NULL,
    old_vl_json JSON COMMENT 'Old values',
    nw_vl_json JSON COMMENT 'New values',
    ip_addr_tx VARCHAR(45),
    usr_agnt_tx TEXT,
    i_ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user (usr_id),
    INDEX idx_action (actn_cd),
    INDEX idx_date (i_ts)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Audit trail logs';

-- ============================================
-- 12. SETTINGS TABLES
-- ============================================

-- App settings/configuration
CREATE TABLE app_settings_t (
    sttng_id INT PRIMARY KEY AUTO_INCREMENT,
    sttng_ky_tx VARCHAR(100) UNIQUE NOT NULL,
    sttng_vl_tx TEXT,
    dscrptn_tx VARCHAR(255),
    a_in TINYINT(1) DEFAULT 1,
    i_ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    u_ts TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_key (sttng_ky_tx)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Application settings';

-- User preferences
CREATE TABLE user_preferences_t (
    prf_id INT PRIMARY KEY AUTO_INCREMENT,
    usr_id INT NOT NULL UNIQUE,
    lng_cd VARCHAR(10) DEFAULT 'en' COMMENT 'Language code',
    ntfctn_enbl_in TINYINT(1) DEFAULT 1,
    lc_shre_in TINYINT(1) DEFAULT 1 COMMENT 'Location sharing enabled',
    prfrncs_json JSON COMMENT 'Additional preferences',
    i_ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    u_ts TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (usr_id) REFERENCES users_t(usr_id) ON DELETE CASCADE,
    INDEX idx_user (usr_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='User preferences';

-- ============================================
-- TRIGGERS FOR AUTOMATED UPDATES
-- ============================================

DELIMITER //

-- Trigger to update station available chargers count
CREATE TRIGGER after_session_start 
AFTER UPDATE ON charging_sessions_t
FOR EACH ROW
BEGIN
    IF NEW.sttus_cd = 'active' AND OLD.sttus_cd != 'active' THEN
        UPDATE charging_stations_t 
        SET avlbl_chrgrs_nbr = avlbl_chrgrs_nbr - 1
        WHERE sttn_id = NEW.sttn_id AND avlbl_chrgrs_nbr > 0;
    END IF;
END//

-- Trigger to update station available chargers when session completes
CREATE TRIGGER after_session_end 
AFTER UPDATE ON charging_sessions_t
FOR EACH ROW
BEGIN
    IF NEW.sttus_cd IN ('completed', 'cancelled', 'failed') 
       AND OLD.sttus_cd = 'active' THEN
        UPDATE charging_stations_t 
        SET avlbl_chrgrs_nbr = avlbl_chrgrs_nbr + 1
        WHERE sttn_id = NEW.sttn_id 
        AND avlbl_chrgrs_nbr < ttl_chrgrs_nbr;
    END IF;
END//

-- Trigger to update user statistics after session completion
CREATE TRIGGER after_session_complete
AFTER UPDATE ON charging_sessions_t
FOR EACH ROW
BEGIN
    IF NEW.sttus_cd = 'completed' AND OLD.sttus_cd != 'completed' THEN
        INSERT INTO user_statistics_t (usr_id, ttl_sssns_nbr, ttl_enrgy_kwh, ttl_spnt_amt, co2_svd_kg)
        VALUES (NEW.usr_id, 1, NEW.enrgy_cnsmd_kwh, NEW.ttl_cst_amt, NEW.enrgy_cnsmd_kwh * 0.82)
        ON DUPLICATE KEY UPDATE
            ttl_sssns_nbr = ttl_sssns_nbr + 1,
            ttl_enrgy_kwh = ttl_enrgy_kwh + NEW.enrgy_cnsmd_kwh,
            ttl_spnt_amt = ttl_spnt_amt + NEW.ttl_cst_amt,
            co2_svd_kg = co2_svd_kg + (NEW.enrgy_cnsmd_kwh * 0.82);
    END IF;
END//

DELIMITER ;

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Add composite indexes for common queries
CREATE INDEX idx_session_user_date ON charging_sessions_t(usr_id, i_ts DESC);
CREATE INDEX idx_transaction_user_date ON wallet_transactions_t(usr_id, i_ts DESC);
CREATE INDEX idx_station_location_active ON charging_stations_t(ltde_nbr, lngtde_nbr, a_in);

-- ============================================
-- SAMPLE DATA INSERTS (Optional)
-- ============================================

-- Sample charging stations - Rajahmundry, Andhra Pradesh, India
INSERT INTO charging_stations_t (
    sttn_nm_tx, sttn_cd, addr_tx, cty_tx, stte_tx,
    ltde_nbr, lngtde_nbr, prce_per_kwh_amt,
    ttl_chrgrs_nbr, avlbl_chrgrs_nbr, rtng_nbr,
    is_fst_chrgng_in, pwr_tx, oprtr_nm_tx
) VALUES 
('DJT HAIKA PowerHub Main Road', 'DJT001', 'Main Road, Near RTC Bus Stand', 'Rajahmundry', 'Andhra Pradesh',
 17.0000, 81.7833, 10.00, 4, 3, 4.5, 1, '150kW', 'DJT HAIKA'),
('DJT HAIKA EcoCharge Godavari', 'DJT002', 'Godavari Bund Road, Near Pushkar Ghat', 'Rajahmundry', 'Andhra Pradesh',
 17.0080, 81.7900, 8.00, 6, 4, 4.2, 0, '22kW', 'DJT HAIKA'),
('DJT HAIKA QuickCharge Express', 'DJT003', 'NH-16, Near Katheru Junction', 'Rajahmundry', 'Andhra Pradesh',
 16.9920, 81.7750, 12.00, 3, 2, 4.7, 1, '350kW', 'DJT HAIKA');

-- Sample app settings
INSERT INTO app_settings_t (sttng_ky_tx, sttng_vl_tx, dscrptn_tx) VALUES
('otp_expiry_minutes', '5', 'OTP expiry duration in minutes'),
('max_otp_attempts', '3', 'Maximum OTP verification attempts'),
('min_wallet_balance', '100', 'Minimum wallet balance'),
('co2_conversion_factor', '0.82', 'CO2 saved per kWh (kg)');
