-- =====================================================================
-- Payment & Double-Entry Ledger — Phase 0 schema
-- Target: DJT_POWERTECH_DEV (MySQL/MariaDB, InnoDB, utf8mb4)
-- Idempotent: safe to re-run (CREATE TABLE IF NOT EXISTS + upsert seeds).
-- Design: database/PAYMENT_LEDGER_DESIGN.md
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Payment status master (lookup)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `pay_sttus_lst_t` (
  `pay_sttus_id`   INT(11) NOT NULL AUTO_INCREMENT,
  `pay_sttus_cd`   VARCHAR(30)  NOT NULL,
  `pay_sttus_nm_tx` VARCHAR(60) NULL,
  `dscrptn_tx`     VARCHAR(255) NULL,
  `is_trmnl_in`    TINYINT(1)   NOT NULL DEFAULT 0,
  `srt_ordr_nbr`   INT(11)      NULL DEFAULT 0,
  `a_in`           TINYINT(1)   NOT NULL DEFAULT 1,
  `i_ts`           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `u_ts`           TIMESTAMP    NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`pay_sttus_id`),
  UNIQUE KEY `uq_pay_sttus_cd` (`pay_sttus_cd`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 2. Payment mode master (lookup)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `pay_mode_lst_t` (
  `pay_mode_id`   INT(11) NOT NULL AUTO_INCREMENT,
  `pay_mode_cd`   VARCHAR(30) NOT NULL,
  `pay_mode_nm_tx` VARCHAR(60) NULL,
  `is_gtwy_in`    TINYINT(1)  NOT NULL DEFAULT 0,
  `is_actv_in`    TINYINT(1)  NOT NULL DEFAULT 1,
  `icon_tx`       VARCHAR(60) NULL,
  `srt_ordr_nbr`  INT(11)     NULL DEFAULT 0,
  `a_in`          TINYINT(1)  NOT NULL DEFAULT 1,
  `i_ts`          TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `u_ts`          TIMESTAMP   NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`pay_mode_id`),
  UNIQUE KEY `uq_pay_mode_cd` (`pay_mode_cd`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 3. Ledger accounts
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `acct_lst_t` (
  `acct_id`     INT(11) NOT NULL AUTO_INCREMENT,
  `acct_cd`     VARCHAR(60) NOT NULL                COMMENT 'WALLET_<usr>, OWNER_<usr>, PLATFORM_REVENUE, GATEWAY_RZP, ESCROW_HOLD',
  `acct_typ_cd` VARCHAR(30) NOT NULL                COMMENT 'customer_wallet, owner_earnings, platform_revenue, gateway_clearing, escrow_hold, refund_payable',
  `usr_id`      INT(11)     NULL                    COMMENT 'Owning user for customer_wallet',
  `ownr_usr_id` INT(11)     NULL                    COMMENT 'Owning user for owner_earnings',
  `sttn_id`     INT(11)     NULL                    COMMENT 'Station-specific account (optional)',
  `crncy_cd`    VARCHAR(10) NOT NULL DEFAULT 'INR',
  `blnce_amt`   DECIMAL(14,2) NOT NULL DEFAULT 0.00 COMMENT 'Cached balance; authoritative = SUM(legs)',
  `is_systm_in` TINYINT(1)  NOT NULL DEFAULT 0      COMMENT '1=system account (may go negative)',
  `a_in`        TINYINT(1)  NOT NULL DEFAULT 1,
  `i_ts`        TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `u_ts`        TIMESTAMP   NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`acct_id`),
  UNIQUE KEY `uq_acct_cd` (`acct_cd`),
  KEY `ix_acct_usr` (`usr_id`),
  KEY `ix_acct_ownr` (`ownr_usr_id`),
  KEY `ix_acct_typ` (`acct_typ_cd`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 4. Journal entries (transaction headers)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `jrnl_lst_t` (
  `jrnl_id`           INT(11) NOT NULL AUTO_INCREMENT,
  `jrnl_cd`           VARCHAR(60) NOT NULL,
  `jrnl_typ_cd`       VARCHAR(30) NOT NULL           COMMENT 'wallet_topup, charging_hold, charging_payment, charging_refund, payout, reversal, adjustment',
  `ref_typ_cd`        VARCHAR(30) NULL               COMMENT 'session, pay_order, settlement, manual',
  `ref_id`            INT(11)     NULL,
  `ttl_amt`           DECIMAL(14,2) NOT NULL,
  `crncy_cd`          VARCHAR(10) NOT NULL DEFAULT 'INR',
  `sttus_cd`          VARCHAR(20) NOT NULL DEFAULT 'posted',
  `rvrsl_of_jrnl_id`  INT(11)     NULL,
  `idmpncy_ky_tx`     VARCHAR(120) NULL,
  `dscrptn_tx`        VARCHAR(255) NULL,
  `mtdata_json`       LONGTEXT    NULL,
  `insrt_usr_id`      INT(11)     NULL,
  `a_in`              TINYINT(1)  NOT NULL DEFAULT 1,
  `i_ts`              TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `u_ts`              TIMESTAMP   NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`jrnl_id`),
  UNIQUE KEY `uq_jrnl_cd` (`jrnl_cd`),
  UNIQUE KEY `uq_jrnl_idmpncy` (`idmpncy_ky_tx`),
  KEY `ix_jrnl_ref` (`ref_typ_cd`, `ref_id`),
  KEY `ix_jrnl_typ` (`jrnl_typ_cd`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 5. Journal legs (postings — the from/to debit/credit lines)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `jrnl_leg_lst_t` (
  `leg_id`         INT(11) NOT NULL AUTO_INCREMENT,
  `jrnl_id`        INT(11) NOT NULL,
  `acct_id`        INT(11) NOT NULL,
  `drct_cd`        VARCHAR(6) NOT NULL              COMMENT 'debit | credit',
  `amt`            DECIMAL(14,2) NOT NULL,
  `blnce_aftr_amt` DECIMAL(14,2) NOT NULL           COMMENT 'Account running balance after this leg',
  `memo_tx`        VARCHAR(255) NULL,
  `i_ts`           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`leg_id`),
  KEY `ix_leg_jrnl` (`jrnl_id`),
  KEY `ix_leg_acct` (`acct_id`),
  CONSTRAINT `fk_leg_jrnl` FOREIGN KEY (`jrnl_id`) REFERENCES `jrnl_lst_t` (`jrnl_id`),
  CONSTRAINT `fk_leg_acct` FOREIGN KEY (`acct_id`) REFERENCES `acct_lst_t` (`acct_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 6. Commission / split rules (effective-dated, overridable)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `cmsn_rule_lst_t` (
  `rule_id`     INT(11) NOT NULL AUTO_INCREMENT,
  `scope_cd`    VARCHAR(10) NOT NULL                COMMENT 'global | station | owner',
  `sttn_id`     INT(11)     NULL,
  `ownr_usr_id` INT(11)     NULL,
  `ownr_pct`    DECIMAL(5,2) NOT NULL,
  `platfrm_pct` DECIMAL(5,2) NOT NULL,
  `tax_pct`     DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `eff_frm_ts`  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `eff_to_ts`   TIMESTAMP   NULL,
  `prirty_nbr`  INT(11)     NOT NULL DEFAULT 0,
  `a_in`        TINYINT(1)  NOT NULL DEFAULT 1,
  `i_ts`        TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `u_ts`        TIMESTAMP   NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`rule_id`),
  KEY `ix_cmsn_scope` (`scope_cd`),
  KEY `ix_cmsn_sttn` (`sttn_id`),
  KEY `ix_cmsn_ownr` (`ownr_usr_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 7. Gateway webhook log (reliable async confirmation + reconciliation)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `pay_wbhk_lst_t` (
  `wbhk_id`           INT(11) NOT NULL AUTO_INCREMENT,
  `evnt_id_tx`        VARCHAR(120) NOT NULL,
  `evnt_typ_tx`       VARCHAR(60)  NULL,
  `pay_ordr_id`       INT(11)      NULL,
  `rzrpy_ordr_id_tx`  VARCHAR(100) NULL,
  `rzrpy_pymnt_id_tx` VARCHAR(100) NULL,
  `sgntr_vld_in`      TINYINT(1)   NOT NULL DEFAULT 0,
  `prcsd_in`          TINYINT(1)   NOT NULL DEFAULT 0,
  `prcsd_ts`          TIMESTAMP    NULL,
  `paylod_json`       LONGTEXT     NULL,
  `i_ts`              TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`wbhk_id`),
  UNIQUE KEY `uq_wbhk_evnt` (`evnt_id_tx`),
  KEY `ix_wbhk_ordr` (`rzrpy_ordr_id_tx`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 8. Owner settlements / payouts
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `setlmnt_lst_t` (
  `setlmnt_id`  INT(11) NOT NULL AUTO_INCREMENT,
  `ownr_usr_id` INT(11) NOT NULL,
  `acct_id`     INT(11) NOT NULL,
  `prd_frm_dt`  DATE    NULL,
  `prd_to_dt`   DATE    NULL,
  `gross_amt`   DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `cmsn_amt`    DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `tax_amt`     DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `net_amt`     DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `sttus_cd`    VARCHAR(20) NOT NULL DEFAULT 'pending',
  `utr_tx`      VARCHAR(60) NULL,
  `jrnl_id`     INT(11)     NULL,
  `i_ts`        TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `u_ts`        TIMESTAMP   NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`setlmnt_id`),
  KEY `ix_setlmnt_ownr` (`ownr_usr_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
-- Master-data seeds (idempotent upserts)
-- =====================================================================
INSERT INTO `pay_sttus_lst_t` (`pay_sttus_cd`,`pay_sttus_nm_tx`,`dscrptn_tx`,`is_trmnl_in`,`srt_ordr_nbr`) VALUES
  ('created','Created','Order created, awaiting payment',0,1),
  ('pending','Pending','Payment in progress',0,2),
  ('paid','Paid','Payment captured successfully',1,3),
  ('failed','Failed','Payment failed',1,4),
  ('cancelled','Cancelled','Payment/transaction cancelled',1,5),
  ('refunded','Refunded','Fully refunded',1,6),
  ('partially_refunded','Partially Refunded','Partially refunded',1,7),
  ('completed','Completed','Ledger posting completed',1,8)
ON DUPLICATE KEY UPDATE `pay_sttus_nm_tx`=VALUES(`pay_sttus_nm_tx`), `dscrptn_tx`=VALUES(`dscrptn_tx`), `is_trmnl_in`=VALUES(`is_trmnl_in`), `srt_ordr_nbr`=VALUES(`srt_ordr_nbr`);

INSERT INTO `pay_mode_lst_t` (`pay_mode_cd`,`pay_mode_nm_tx`,`is_gtwy_in`,`is_actv_in`,`srt_ordr_nbr`) VALUES
  ('wallet','Wallet',0,1,1),
  ('upi','UPI',1,1,2),
  ('card','Card',1,1,3),
  ('netbanking','Net Banking',1,1,4)
ON DUPLICATE KEY UPDATE `pay_mode_nm_tx`=VALUES(`pay_mode_nm_tx`), `is_gtwy_in`=VALUES(`is_gtwy_in`), `is_actv_in`=VALUES(`is_actv_in`), `srt_ordr_nbr`=VALUES(`srt_ordr_nbr`);

-- System ledger accounts (one-per-code; balances are managed by the ledger engine)
INSERT INTO `acct_lst_t` (`acct_cd`,`acct_typ_cd`,`is_systm_in`,`crncy_cd`) VALUES
  ('GATEWAY_RZP','gateway_clearing',1,'INR'),
  ('PLATFORM_REVENUE','platform_revenue',1,'INR'),
  ('ESCROW_HOLD','escrow_hold',1,'INR')
ON DUPLICATE KEY UPDATE `acct_typ_cd`=VALUES(`acct_typ_cd`), `is_systm_in`=VALUES(`is_systm_in`);
