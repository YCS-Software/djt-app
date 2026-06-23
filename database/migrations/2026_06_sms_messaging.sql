-- =====================================================================
-- SMS Messaging — templates + per-message audit log
-- Target: DJT_POWERTECH_DEV (MySQL/MariaDB, InnoDB, utf8mb4)
-- Idempotent: safe to re-run (CREATE TABLE IF NOT EXISTS + upsert seed).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. SMS template master
--    One row per approved provider template. The body carries ##varN##
--    style placeholders that are substituted at send time.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `sms_tmplt_lst_t` (
  `tmplt_id`           BIGINT       NOT NULL AUTO_INCREMENT,
  `prvdr_tmplt_id_tx`  VARCHAR(64)  NOT NULL COMMENT 'MSG91 template/flow id',
  `tmplt_nm_tx`        VARCHAR(100) NULL     COMMENT 'human label, e.g. OTP',
  `body_tx`            TEXT         NOT NULL  COMMENT 'template body with ##varN## placeholders',
  `sndr_id_tx`         VARCHAR(20)  NULL      COMMENT 'DLT sender id override (falls back to env)',
  `prvdr_cd`           VARCHAR(20)  NOT NULL DEFAULT 'MSG91',
  `dscrptn_tx`         VARCHAR(255) NULL,
  `a_in`               TINYINT(1)   NOT NULL DEFAULT 1 COMMENT 'active flag',
  `i_ts`               TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `u_ts`               TIMESTAMP    NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`tmplt_id`),
  UNIQUE KEY `uq_sms_tmplt_prvdr_id` (`prvdr_tmplt_id_tx`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 2. SMS message log (audit)
--    One row per send attempt. Captures the exact rendered body, the
--    variables used, the provider response and the delivery status so
--    every message is traceable.
--    stts_cd: PENDING | SENT | FAILED | MOCK
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `sms_msg_log_t` (
  `msg_id`             BIGINT       NOT NULL AUTO_INCREMENT,
  `tmplt_id`           BIGINT       NULL     COMMENT 'FK -> sms_tmplt_lst_t.tmplt_id',
  `prvdr_tmplt_id_tx`  VARCHAR(64)  NULL     COMMENT 'denormalized provider template id',
  `mobile_tx`          VARCHAR(20)  NOT NULL COMMENT 'normalized recipient (countrycode + number)',
  `vars_tx`            JSON         NULL     COMMENT 'key/value variables supplied for this message',
  `rndrd_body_tx`      TEXT         NULL     COMMENT 'final body after variable substitution',
  `sndr_id_tx`         VARCHAR(20)  NULL,
  `stts_cd`            VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
  `prvdr_msg_id_tx`    VARCHAR(100) NULL     COMMENT 'provider request/message id',
  `prvdr_rspns_tx`     TEXT         NULL     COMMENT 'raw provider response (JSON)',
  `err_tx`             TEXT         NULL     COMMENT 'error message when stts_cd = FAILED',
  `is_mock_in`         TINYINT(1)   NOT NULL DEFAULT 0 COMMENT 'sent in mock mode (not delivered)',
  `usr_id`             BIGINT       NULL     COMMENT 'optional linked user',
  `i_ts`               TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `u_ts`               TIMESTAMP    NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`msg_id`),
  KEY `ix_sms_log_mobile` (`mobile_tx`),
  KEY `ix_sms_log_status` (`stts_cd`),
  KEY `ix_sms_log_tmplt` (`tmplt_id`),
  CONSTRAINT `fk_sms_log_tmplt` FOREIGN KEY (`tmplt_id`)
      REFERENCES `sms_tmplt_lst_t` (`tmplt_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 3. SMS gateway config (key/value settings)
--    Holds non-secret gateway settings that used to live in .env:
--    sender id, country code and the default OTP template id. The auth
--    key stays in the environment (it is a secret).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `sms_cnfg_t` (
  `cnfg_id`     INT          NOT NULL AUTO_INCREMENT,
  `cnfg_ky_tx`  VARCHAR(50)  NOT NULL,
  `cnfg_vl_tx`  VARCHAR(255) NULL,
  `dscrptn_tx`  VARCHAR(255) NULL,
  `a_in`        TINYINT(1)   NOT NULL DEFAULT 1,
  `i_ts`        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `u_ts`        TIMESTAMP    NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`cnfg_id`),
  UNIQUE KEY `uq_sms_cnfg_ky` (`cnfg_ky_tx`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Sender id is stored per-template (sms_tmplt_lst_t.sndr_id_tx), not globally.
INSERT INTO `sms_cnfg_t` (`cnfg_ky_tx`, `cnfg_vl_tx`, `dscrptn_tx`) VALUES
    ('DEFAULT_COUNTRY_CODE',   '91',                         'Country code prepended to bare 10-digit numbers'),
    ('DEFAULT_OTP_TEMPLATE_ID','6a3a2c9e142b52e3340a24c3',   'Template used by sendOTP when none is specified')
ON DUPLICATE KEY UPDATE
    `dscrptn_tx` = VALUES(`dscrptn_tx`);

-- Sender id moved onto the template; remove the old global default if present.
DELETE FROM `sms_cnfg_t` WHERE `cnfg_ky_tx` = 'DEFAULT_SENDER_ID';

-- ---------------------------------------------------------------------
-- 4. Seed the OTP template (upsert — refreshes body on re-run)
-- ---------------------------------------------------------------------
INSERT INTO `sms_tmplt_lst_t`
    (`prvdr_tmplt_id_tx`, `tmplt_nm_tx`, `body_tx`, `sndr_id_tx`, `prvdr_cd`, `dscrptn_tx`, `a_in`)
VALUES
    ('6a3a2c9e142b52e3340a24c3', 'OTP',
     'Your One Time Password (OTP) is ##var1##\n\nValid for 5 minutes. Do not share this OTP with anyone.\n\n- DJT EV POWER TECH PVT LTD',
     'DJT1', 'MSG91', 'Login / signup OTP', 1)
ON DUPLICATE KEY UPDATE
    `tmplt_nm_tx` = VALUES(`tmplt_nm_tx`),
    `body_tx`     = VALUES(`body_tx`),
    `sndr_id_tx`  = VALUES(`sndr_id_tx`),
    `dscrptn_tx`  = VALUES(`dscrptn_tx`),
    `a_in`        = VALUES(`a_in`);
