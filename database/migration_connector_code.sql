-- ============================================================================
-- MIGRATION: Per-connector code (each connector gets its own code + QR)
-- Adds cnntr_cd_tx to cnntr_lst_t and backfills existing rows as
-- <machine ocpp id>-C<n>. New connectors get a code at creation time.
-- ============================================================================

ALTER TABLE cnntr_lst_t
    ADD COLUMN cnntr_cd_tx VARCHAR(60) NULL COMMENT 'Unique connector code' AFTER mchn_id,
    ADD INDEX idx_cnntr_cd (cnntr_cd_tx);

-- Backfill: number connectors per machine and prefix with the machine OCPP id
UPDATE cnntr_lst_t c
JOIN (
    SELECT cnntr_id,
           mchn_id,
           ROW_NUMBER() OVER (PARTITION BY mchn_id ORDER BY cnntr_id) AS seq
    FROM cnntr_lst_t
) r ON c.cnntr_id = r.cnntr_id
JOIN mchn_lst_t m ON c.mchn_id = m.mchn_id
SET c.cnntr_cd_tx = CONCAT(COALESCE(m.ocpp_id_tx, CONCAT('M', c.mchn_id)), '-C', r.seq)
WHERE c.cnntr_cd_tx IS NULL OR c.cnntr_cd_tx = '';
