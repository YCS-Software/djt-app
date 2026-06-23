-- ============================================
-- SCHEMA VERIFICATION SCRIPT
-- Run this to verify all tables and columns exist
-- ============================================

-- Check if all tables exist
SELECT 'Checking Tables...' as status;

SELECT 
    TABLE_NAME,
    TABLE_ROWS,
    CREATE_TIME
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME IN (
    'usr_lst_t',
    'otp_lst_t',
    'tkn_lst_t',
    'wllt_lst_t',
    'trxn_lst_t',
    'sttn_lst_t',
    'cnntr_lst_t',
    'fvrt_lst_t',
    'sssn_lst_t',
    'sssn_log_lst_t',
    'bkng_lst_t',
    'vhcl_lst_t',
    'rvw_lst_t',
    'ntfctn_lst_t',
    'offr_lst_t',
    'usg_lst_t',
    'stt_lst_t',
    'audt_lst_t',
    'sttng_lst_t',
    'prf_lst_t'
)
ORDER BY TABLE_NAME;

-- Check usr_lst_t columns
SELECT 'Verifying usr_lst_t columns...' as status;
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'usr_lst_t'
ORDER BY ORDINAL_POSITION;

-- Check otp_lst_t columns
SELECT 'Verifying otp_lst_t columns...' as status;
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'otp_lst_t'
ORDER BY ORDINAL_POSITION;

-- Check wllt_lst_t columns
SELECT 'Verifying wllt_lst_t columns...' as status;
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'wllt_lst_t'
ORDER BY ORDINAL_POSITION;

-- Check trxn_lst_t columns
SELECT 'Verifying trxn_lst_t columns...' as status;
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'trxn_lst_t'
ORDER BY ORDINAL_POSITION;

-- Check sttn_lst_t columns
SELECT 'Verifying sttn_lst_t columns...' as status;
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'sttn_lst_t'
ORDER BY ORDINAL_POSITION;

-- Check cnntr_lst_t columns
SELECT 'Verifying cnntr_lst_t columns...' as status;
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'cnntr_lst_t'
ORDER BY ORDINAL_POSITION;

-- Check sssn_lst_t columns
SELECT 'Verifying sssn_lst_t columns...' as status;
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'sssn_lst_t'
ORDER BY ORDINAL_POSITION;

-- Check vhcl_lst_t columns
SELECT 'Verifying vhcl_lst_t columns...' as status;
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'vhcl_lst_t'
ORDER BY ORDINAL_POSITION;

-- Check bkng_lst_t columns
SELECT 'Verifying bkng_lst_t columns...' as status;
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'bkng_lst_t'
ORDER BY ORDINAL_POSITION;

-- Verify all foreign keys exist
SELECT 'Checking Foreign Keys...' as status;
SELECT 
    TABLE_NAME,
    COLUMN_NAME,
    CONSTRAINT_NAME,
    REFERENCED_TABLE_NAME,
    REFERENCED_COLUMN_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = DATABASE()
AND REFERENCED_TABLE_NAME IS NOT NULL
ORDER BY TABLE_NAME, COLUMN_NAME;

-- Verify all indexes exist
SELECT 'Checking Indexes...' as status;
SELECT 
    TABLE_NAME,
    INDEX_NAME,
    GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) as COLUMNS,
    NON_UNIQUE
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME LIKE '%_t'
GROUP BY TABLE_NAME, INDEX_NAME, NON_UNIQUE
ORDER BY TABLE_NAME, INDEX_NAME;

-- Verify triggers exist
SELECT 'Checking Triggers...' as status;
SELECT 
    TRIGGER_NAME,
    EVENT_MANIPULATION,
    EVENT_OBJECT_TABLE,
    ACTION_TIMING
FROM information_schema.TRIGGERS
WHERE TRIGGER_SCHEMA = DATABASE()
ORDER BY EVENT_OBJECT_TABLE, TRIGGER_NAME;

-- Sample data check
SELECT 'Checking Sample Data...' as status;
SELECT 'sttn_lst_t' as table_name, COUNT(*) as record_count FROM sttn_lst_t
UNION ALL
SELECT 'usr_lst_t', COUNT(*) FROM usr_lst_t
UNION ALL
SELECT 'wllt_lst_t', COUNT(*) FROM wllt_lst_t
UNION ALL
SELECT 'sssn_lst_t', COUNT(*) FROM sssn_lst_t;

-- Verify database character set
SELECT 'Checking Database Configuration...' as status;
SELECT 
    DEFAULT_CHARACTER_SET_NAME,
    DEFAULT_COLLATION_NAME
FROM information_schema.SCHEMATA
WHERE SCHEMA_NAME = DATABASE();

SELECT 'Schema verification complete!' as status;
