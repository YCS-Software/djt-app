-- ============================================================================
-- MIGRATION: Owner registration + station ownership + machine/infrastructure
--            + Razorpay payment-order audit
-- Safe to run on an existing DJT_POWERTECH_DEV database (idempotent-ish).
-- Run order matters: tables referenced by FKs must exist first.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Users: allow 'owner' user type (column already exists, comment only)
-- ----------------------------------------------------------------------------
ALTER TABLE usr_lst_t
    MODIFY COLUMN usr_typ_cd VARCHAR(20) DEFAULT 'customer'
    COMMENT 'customer, owner, admin, operator';

-- ----------------------------------------------------------------------------
-- 2. Stations: add owner + approval status
-- ----------------------------------------------------------------------------
ALTER TABLE sttn_lst_t
    ADD COLUMN ownr_usr_id INT NULL COMMENT 'Station owner (FK usr_lst_t); NULL = platform-owned' AFTER sttn_id,
    ADD COLUMN aprvl_sttus_cd VARCHAR(20) DEFAULT 'active' COMMENT 'active, pending, rejected, suspended' AFTER ownr_usr_id;

ALTER TABLE sttn_lst_t
    ADD INDEX idx_owner (ownr_usr_id),
    ADD INDEX idx_approval (aprvl_sttus_cd);

ALTER TABLE sttn_lst_t
    ADD CONSTRAINT fk_sttn_owner FOREIGN KEY (ownr_usr_id)
    REFERENCES usr_lst_t(usr_id) ON DELETE SET NULL;

-- ----------------------------------------------------------------------------
-- 3. Machines / chargers (physical OCPP charge points per station)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mchn_lst_t (
    mchn_id INT PRIMARY KEY AUTO_INCREMENT,
    sttn_id INT NOT NULL,
    mchn_nm_tx VARCHAR(100) NOT NULL COMMENT 'Machine label e.g. Charger 1',
    mchn_srl_no_tx VARCHAR(100) COMMENT 'Manufacturer serial number',
    ocpp_id_tx VARCHAR(100) COMMENT 'OCPP ChargePoint identity (unique per machine)',
    mchn_typ_cd VARCHAR(20) DEFAULT 'DC' COMMENT 'AC, DC',
    max_pwr_tx VARCHAR(20) COMMENT 'Max power e.g. 60kW',
    ttl_cnntrs_nbr INT DEFAULT 1 COMMENT 'Number of connectors on this machine',
    sttus_cd VARCHAR(20) DEFAULT 'available' COMMENT 'available, in_use, offline, faulted, maintenance',
    a_in TINYINT(1) DEFAULT 1,
    i_ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    u_ts TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (sttn_id) REFERENCES sttn_lst_t(sttn_id) ON DELETE CASCADE,
    INDEX idx_station (sttn_id),
    INDEX idx_status (sttus_cd),
    INDEX idx_ocpp (ocpp_id_tx)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Charging machines per station (OCPP charge points)';

-- ----------------------------------------------------------------------------
-- 4. Connectors: link to a machine
-- ----------------------------------------------------------------------------
ALTER TABLE cnntr_lst_t
    ADD COLUMN mchn_id INT NULL COMMENT 'Owning machine (FK mchn_lst_t)' AFTER sttn_id;

ALTER TABLE cnntr_lst_t
    ADD INDEX idx_machine (mchn_id);

ALTER TABLE cnntr_lst_t
    ADD CONSTRAINT fk_cnntr_machine FOREIGN KEY (mchn_id)
    REFERENCES mchn_lst_t(mchn_id) ON DELETE CASCADE;

-- ----------------------------------------------------------------------------
-- 5. Razorpay payment-order audit trail
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pay_ordr_lst_t (
    pay_ordr_id INT PRIMARY KEY AUTO_INCREMENT,
    usr_id INT NOT NULL,
    rzrpy_ordr_id_tx VARCHAR(100) COMMENT 'Razorpay order id (or mock id)',
    rzrpy_pymnt_id_tx VARCHAR(100) COMMENT 'Razorpay payment id',
    rzrpy_sgntr_tx VARCHAR(255) COMMENT 'Razorpay signature',
    amt DECIMAL(10,2) NOT NULL,
    crncy_cd VARCHAR(10) DEFAULT 'INR',
    purpose_cd VARCHAR(30) DEFAULT 'wallet_topup' COMMENT 'wallet_topup',
    pymnt_mthd_cd VARCHAR(30) COMMENT 'upi, card, netbanking',
    sttus_cd VARCHAR(20) DEFAULT 'created' COMMENT 'created, paid, failed',
    is_mock_in TINYINT(1) DEFAULT 0 COMMENT 'Mock payment flag: 1=mock, 0=live',
    trxn_id INT NULL COMMENT 'Linked wallet transaction after credit',
    a_in TINYINT(1) DEFAULT 1,
    i_ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    u_ts TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (usr_id) REFERENCES usr_lst_t(usr_id) ON DELETE CASCADE,
    INDEX idx_user (usr_id),
    INDEX idx_order (rzrpy_ordr_id_tx),
    INDEX idx_status (sttus_cd)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Razorpay payment order audit trail';
