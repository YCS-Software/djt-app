-- ============================================================================
-- OCPP WebSocket request/response audit log
-- Database: DJT_POWERTECH_DEV (MySQL / InnoDB)
--
-- Captures every OCPP message exchanged with a charge point (both directions),
-- plus connection lifecycle events, so external charger vendors / support can
-- trace exactly what was sent and received. Safe to re-run (IF NOT EXISTS).
-- ============================================================================

CREATE TABLE IF NOT EXISTS ocpp_msg_log_t (
    msg_log_id   BIGINT       PRIMARY KEY AUTO_INCREMENT,
    ocpp_id_tx   VARCHAR(100) NOT NULL  COMMENT 'Charge point identity (path /ocpp/<id>)',
    mchn_id      INT          NULL      COMMENT 'Resolved machine id (mchn_lst_t), if known',
    sttn_id      INT          NULL      COMMENT 'Resolved station id, if known',
    drctn_cd     VARCHAR(10)  NOT NULL  COMMENT 'in = CP->CSMS, out = CSMS->CP, sys = lifecycle',
    msg_typ_cd   VARCHAR(20)  NOT NULL  COMMENT 'CALL / CALLRESULT / CALLERROR / CONNECT / DISCONNECT / ERROR',
    ocpp_msg_id_tx VARCHAR(100) NULL    COMMENT 'OCPP message id — correlates request<->response',
    actn_tx      VARCHAR(60)  NULL      COMMENT 'OCPP action, e.g. BootNotification, TransactionEvent',
    payld_json   JSON         NULL      COMMENT 'Full message payload (request or response)',
    err_cd_tx    VARCHAR(60)  NULL      COMMENT 'CALLERROR code, if any',
    err_desc_tx  TEXT         NULL      COMMENT 'CALLERROR description / failure reason',
    ltncy_ms_nbr INT          NULL      COMMENT 'Round-trip latency (ms) for CSMS-initiated calls',
    rmt_addr_tx  VARCHAR(45)  NULL      COMMENT 'Charge point remote IP address',
    i_ts         TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ocpp   (ocpp_id_tx),
    INDEX idx_mchn   (mchn_id),
    INDEX idx_action (actn_tx),
    INDEX idx_msgid  (ocpp_msg_id_tx),
    INDEX idx_dir    (drctn_cd),
    INDEX idx_date   (i_ts)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='OCPP WebSocket request/response audit log';
