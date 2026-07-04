-- ============================================================================
-- MIGRATION: Per-connector live status
-- OCPP StatusNotification is per connector ({ connectorId, connectorStatus }).
-- This column tracks each connector's own state so plug-in/out and charging are
-- maintained per connector (not per machine).
-- ============================================================================

ALTER TABLE cnntr_lst_t
    ADD COLUMN cnntr_sttus_cd VARCHAR(20) DEFAULT 'available'
        COMMENT 'available, occupied, charging, reserved, faulted, unavailable' AFTER is_avlbl_in;

UPDATE cnntr_lst_t
SET cnntr_sttus_cd = CASE WHEN is_avlbl_in = 1 THEN 'available' ELSE 'occupied' END
WHERE cnntr_sttus_cd IS NULL OR cnntr_sttus_cd = '';
