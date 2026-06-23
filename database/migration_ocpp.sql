-- ============================================================================
-- MIGRATION: OCPP 2.0.1 support
--   - machine last-heartbeat timestamp
--   - link charging sessions to OCPP transactionId
-- Safe to run on an existing DJT_POWERTECH_DEV database.
-- ============================================================================

-- Machines: last OCPP heartbeat/boot time (online tracking)
ALTER TABLE mchn_lst_t
    ADD COLUMN lst_hb_ts TIMESTAMP NULL COMMENT 'Last OCPP heartbeat/boot timestamp' AFTER sttus_cd;

-- Sessions: OCPP transaction id for charger-initiated sessions
ALTER TABLE sssn_lst_t
    ADD COLUMN ocpp_txn_id_tx VARCHAR(100) NULL COMMENT 'OCPP transactionId (charger-initiated sessions)' AFTER qr_cd_tx;

ALTER TABLE sssn_lst_t
    ADD INDEX idx_ocpp_txn (ocpp_txn_id_tx);
