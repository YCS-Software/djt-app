-- ============================================================================
-- MIGRATION: Machine power master + link from machines
-- Adds a power-options master table (tied to machine type), a FK on mchn_lst_t,
-- and seeds the standard AC/DC/DCS power tiers.
-- ============================================================================

CREATE TABLE IF NOT EXISTS mchn_pwr_lst_t (
    mchn_pwr_id INT PRIMARY KEY AUTO_INCREMENT,
    pwr_cd VARCHAR(20) NOT NULL UNIQUE COMMENT 'e.g. DC-60kW',
    pwr_lbl_tx VARCHAR(40) NOT NULL COMMENT 'Display label e.g. DC 60 kW',
    mchn_typ_cd VARCHAR(10) NOT NULL COMMENT 'AC, DC, DCS',
    kw_nbr DECIMAL(6,2) NOT NULL COMMENT 'Power in kW',
    dflt_cnntr_typ_cd VARCHAR(20) COMMENT 'Default connector type for this power tier',
    srt_nbr INT DEFAULT 0 COMMENT 'Sort order',
    a_in TINYINT(1) DEFAULT 1,
    i_ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_type (mchn_typ_cd)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Machine power options master';

ALTER TABLE mchn_lst_t
    ADD COLUMN mchn_pwr_id INT NULL COMMENT 'Power tier (FK mchn_pwr_lst_t)' AFTER mchn_typ_cd;

ALTER TABLE mchn_lst_t
    ADD INDEX idx_power (mchn_pwr_id);

ALTER TABLE mchn_lst_t
    ADD CONSTRAINT fk_mchn_power FOREIGN KEY (mchn_pwr_id)
    REFERENCES mchn_pwr_lst_t(mchn_pwr_id) ON DELETE SET NULL;

INSERT INTO mchn_pwr_lst_t (pwr_cd, pwr_lbl_tx, mchn_typ_cd, kw_nbr, dflt_cnntr_typ_cd, srt_nbr) VALUES
('AC-3.3kW','AC 3.3 kW','AC',3.3,'Type2',1),
('AC-7.4kW','AC 7.4 kW','AC',7.4,'Type2',2),
('DC-15kW','DC 15 kW','DC',15,'CCS2',3),
('DC-60kW','DC 60 kW','DC',60,'CCS2',4),
('DC-120kW','DC 120 kW','DC',120,'CCS2',5),
('DC-180kW','DC 180 kW','DC',180,'CCS2',6),
('DCS-240kW','DCS 240 kW','DCS',240,'CCS2',7),
('DC-360kW','DC 360 kW','DC',360,'CCS2',8),
('DC-480kW','DC 480 kW','DC',480,'CCS2',9);
