-- ============================================================================
-- Audit action master (reference/lookup for audt_lst_t.actn_cd)
-- Database: DJT_POWERTECH_DEV (MySQL / InnoDB)
--
-- Enumerates every audit action code the app writes, with a human label and a
-- category, so the admin audit-log UI can group/label actions and validate
-- against a known set. Kept as a reference master (no FK on audt_lst_t, so the
-- best-effort audit writes can never be blocked by a missing master row).
-- Safe to re-run (CREATE TABLE IF NOT EXISTS + upsert seed).
-- ============================================================================

CREATE TABLE IF NOT EXISTS actn_lst_t (
    actn_id     INT          PRIMARY KEY AUTO_INCREMENT,
    actn_cd     VARCHAR(50)  NOT NULL UNIQUE COMMENT 'Action code stored in audt_lst_t.actn_cd',
    actn_lbl_tx VARCHAR(100) NOT NULL        COMMENT 'Human-readable label',
    ctgry_cd    VARCHAR(30)  NOT NULL        COMMENT 'auth | session | wallet | scan | infra | admin | ledger',
    dscrptn_tx  VARCHAR(255) NULL            COMMENT 'What the action means',
    a_in        TINYINT(1)   NOT NULL DEFAULT 1,
    i_ts        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_category (ctgry_cd)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Audit action master (codes used in audt_lst_t)';

INSERT INTO actn_lst_t (actn_cd, actn_lbl_tx, ctgry_cd, dscrptn_tx) VALUES
    -- auth
    ('login',               'Login',              'auth',    'User signed in successfully'),
    ('login_failed',        'Login failed',       'auth',    'Failed sign-in attempt'),
    ('otp_sent',            'OTP sent',           'auth',    'OTP dispatched to a phone number'),
    ('register',            'Register',           'auth',    'New user account created'),
    ('token_refresh',       'Token refreshed',    'auth',    'Access token refreshed'),
    -- session (charging)
    ('session_start',       'Session started',    'session', 'Charging session started'),
    ('session_stop',        'Session stopped',    'session', 'Charging session stopped/completed'),
    ('session_payment',     'Session payment',    'session', 'Wallet charged/refunded for a session'),
    -- wallet (legacy direct path)
    ('wallet_add',          'Wallet credit',      'wallet',  'Money added to wallet (legacy add-money path)'),
    ('wallet_deduct',       'Wallet debit',       'wallet',  'Money deducted from wallet (legacy path)'),
    -- scan / QR
    ('charger_scan',        'Charger scanned',    'scan',    'Driver scanned a charger QR (ok/offline/not_found/...)'),
    ('qr_generate',         'QR generated',       'scan',    'Owner generated a charger QR'),
    -- infra (owner)
    ('station_create',      'Station created',    'infra',   'Charging station created'),
    ('station_update',      'Station updated',    'infra',   'Charging station updated'),
    ('machine_create',      'Charger created',    'infra',   'Charger/machine created'),
    ('machine_update',      'Charger updated',    'infra',   'Charger/machine updated'),
    ('connector_create',    'Connector created',  'infra',   'Connector created'),
    -- admin (web console CRUD)
    ('user_create',         'User created',       'admin',   'Admin created a user'),
    ('user_update',         'User updated',       'admin',   'Admin updated a user'),
    ('user_delete',         'User deleted',       'admin',   'Admin deleted a user'),
    ('partner_create',      'Partner created',    'admin',   'Admin created a partner'),
    ('partner_update',      'Partner updated',    'admin',   'Admin updated a partner'),
    ('partner_delete',      'Partner deleted',    'admin',   'Admin deleted a partner'),
    ('location_create',     'Location created',   'admin',   'Admin created a location'),
    ('location_update',     'Location updated',   'admin',   'Admin updated a location'),
    ('location_delete',     'Location deleted',   'admin',   'Admin deleted a location'),
    ('emsp_token_create',   'eMSP token created', 'admin',   'Admin created an eMSP token'),
    ('emsp_token_update',   'eMSP token updated', 'admin',   'Admin updated an eMSP token'),
    ('emsp_token_delete',   'eMSP token deleted', 'admin',   'Admin deleted an eMSP token'),
    ('configuration_create','Configuration created','admin', 'Admin created a configuration'),
    ('configuration_update','Configuration updated','admin', 'Admin updated a configuration'),
    ('setting_update',      'Setting updated',    'admin',   'Admin updated a setting (by scope)'),
    -- ledger (double-entry money movements)
    ('wallet_topup',        'Wallet top-up',      'ledger',  'Wallet credited via payment gateway'),
    ('charging_hold',       'Charging hold',      'ledger',  'Funds held at charge start (escrow)'),
    ('charging_payment',    'Charging payment',   'ledger',  'Charge settled with owner/platform split'),
    ('charging_refund',     'Charging refund',    'ledger',  'Unused hold refunded to the wallet'),
    ('payout',              'Owner payout',       'ledger',  'Settlement payout to a station owner')
ON DUPLICATE KEY UPDATE
    actn_lbl_tx = VALUES(actn_lbl_tx),
    ctgry_cd    = VALUES(ctgry_cd),
    dscrptn_tx  = VALUES(dscrptn_tx),
    a_in        = 1;
