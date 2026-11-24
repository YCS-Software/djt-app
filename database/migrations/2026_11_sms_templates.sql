-- =====================================================================
-- SMS Messaging v2 — database-driven templates and variables
-- Target: MySQL / MariaDB (InnoDB, utf8mb4)
-- Idempotent: safe to re-run. Additive only (nothing is dropped or changed).
--
-- HOW IT WORKS
--   Code sends a message with ONE call, naming the template by its code:
--
--       messages.send('DJT_OTP', '9876543210', { otp: '4821' });
--
--   Two tables describe the template:
--     sms_tmplt_lst_t       one row per approved MSG91 / DLT template
--     sms_tmplt_var_lst_t   one row per ##varN## in its text: which value fills it
--   Every attempt is recorded in sms_msg_log_t.
--
-- ADDING A NEW MESSAGE
--   1. Get the template approved on DLT and created in MSG91.
--   2. INSERT it into sms_tmplt_lst_t (give it a tmplt_cd).
--   3. INSERT one sms_tmplt_var_lst_t row per variable.
--   4. Call messages.send('<tmplt_cd>', mobile, data) where it is needed.
--   A worked example is at the bottom of this file.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Templates: add the code used to send them, and the DLT template id
-- ---------------------------------------------------------------------
ALTER TABLE `sms_tmplt_lst_t`
  ADD COLUMN IF NOT EXISTS `tmplt_cd` VARCHAR(50) NULL
      COMMENT 'code used in messages.send(), e.g. DJT_OTP' AFTER `tmplt_id`,
  ADD COLUMN IF NOT EXISTS `dlt_tmplt_id_tx` VARCHAR(40) NULL
      COMMENT 'DLT content template id (for reference)' AFTER `prvdr_tmplt_id_tx`;

ALTER TABLE `sms_tmplt_lst_t`
  ADD UNIQUE INDEX IF NOT EXISTS `uq_sms_tmplt_cd` (`tmplt_cd`);

-- ---------------------------------------------------------------------
-- 2. Template variables
--    var_nm_tx  the variable name exactly as in the MSG91 template (##var1## -> var1)
--    src_ky_tx  the name of the value in the data passed to messages.send(),
--               e.g. otp, amount, station_name, user.name.
--               Leave NULL to always use dflt_vl_tx.
--    frmt_cd    text | amount (2 decimals) | number | date | time | datetime | mask_mobile
--    dflt_vl_tx used when the data has no value for src_ky_tx
--    mx_lngth_nbr  cut the value to this many characters (DLT allows 30 per variable)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `sms_tmplt_var_lst_t` (
  `var_id`        BIGINT       NOT NULL AUTO_INCREMENT,
  `tmplt_id`      BIGINT       NOT NULL COMMENT 'FK -> sms_tmplt_lst_t.tmplt_id',
  `var_nm_tx`     VARCHAR(50)  NOT NULL COMMENT 'variable name in the provider template, e.g. var1',
  `src_ky_tx`     VARCHAR(100) NULL     COMMENT 'data key that fills it, e.g. otp or user.name',
  `frmt_cd`       VARCHAR(20)  NOT NULL DEFAULT 'text',
  `dflt_vl_tx`    VARCHAR(255) NULL     COMMENT 'value used when the data has none',
  `mx_lngth_nbr`  INT          NULL     COMMENT 'truncate the value to this length',
  `dscrptn_tx`    VARCHAR(255) NULL,
  `a_in`          TINYINT(1)   NOT NULL DEFAULT 1,
  `i_ts`          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `u_ts`          TIMESTAMP    NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`var_id`),
  UNIQUE KEY `uq_sms_tmplt_var` (`tmplt_id`, `var_nm_tx`),
  CONSTRAINT `fk_sms_var_tmplt` FOREIGN KEY (`tmplt_id`)
      REFERENCES `sms_tmplt_lst_t` (`tmplt_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
-- TEMPLATE CODES THE APPLICATION SENDS, AND THE VALUES IT PASSES
-- (a code with no active row is simply not sent, except DJT_OTP which
--  login needs)
--
--   Available to every template:  app_name, date, time, datetime, mobile
--   When a user is involved:      user.name, user.mobile, balance (wallet balance now)
--
--   DJT_OTP          login / signup OTP
--                    otp, expiry_minutes
--   WALLET_CREDITED  money added: top-up, refund of the unused charging amount
--                    amount, reason, reference, station_name, payment_method
--   WALLET_DEBITED   money deducted: charging payment, transfer
--                    amount, reason, reference, station_name
--
--   reason is one of: Wallet top-up, Charging refund, EV charging, Wallet transfer
--   reference is the payment id (top-up) or the session code (charging)
--
-- WORKED EXAMPLE: "money deducted" SMS
--
--   INSERT INTO sms_tmplt_lst_t
--     (tmplt_cd, prvdr_tmplt_id_tx, dlt_tmplt_id_tx, tmplt_nm_tx, body_tx, sndr_id_tx)
--   VALUES
--     ('WALLET_DEBITED', '<MSG91 template id>', '<DLT template id>', 'Wallet debited',
--      'Rs ##var1## deducted from your DJT wallet for ##var2##. Balance: Rs ##var3##. - DJT EV POWER TECH PVT LTD',
--      'DJTEVP');
--   SET @t = (SELECT tmplt_id FROM sms_tmplt_lst_t WHERE tmplt_cd = 'WALLET_DEBITED');
--
--   INSERT INTO sms_tmplt_var_lst_t (tmplt_id, var_nm_tx, src_ky_tx, frmt_cd) VALUES
--     (@t, 'var1', 'amount',  'amount'),
--     (@t, 'var2', 'reason',  'text'),
--     (@t, 'var3', 'balance', 'amount');
--
-- To stop a message, set a_in = 0 on its sms_tmplt_lst_t row.
--
-- NO LONGER USED BY THE CODE (safe to remove by hand when you are ready):
--   DROP TABLE IF EXISTS sms_evnt_tmplt_lst_t;
--   ALTER TABLE sms_msg_log_t DROP COLUMN IF EXISTS evnt_cd;
--   DROP TABLE IF EXISTS sms_cnfg_t;
-- =====================================================================
