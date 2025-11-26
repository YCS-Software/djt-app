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
    'users_t',
    'auth_otp_t',
    'user_tokens_t',
    'wallet_t',
    'wallet_transactions_t',
    'charging_stations_t',
    'station_connectors_t',
    'user_favorite_stations_t',
    'charging_sessions_t',
    'charging_session_logs_t',
    'station_bookings_t',
    'user_vehicles_t',
    'station_reviews_t',
    'notifications_t',
    'offers_t',
    'user_offer_usage_t',
    'user_statistics_t',
    'audit_logs_t',
    'app_settings_t',
    'user_preferences_t'
)
ORDER BY TABLE_NAME;

-- Check users_t columns
SELECT 'Verifying users_t columns...' as status;
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'users_t'
ORDER BY ORDINAL_POSITION;

-- Check auth_otp_t columns
SELECT 'Verifying auth_otp_t columns...' as status;
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'auth_otp_t'
ORDER BY ORDINAL_POSITION;

-- Check wallet_t columns
SELECT 'Verifying wallet_t columns...' as status;
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'wallet_t'
ORDER BY ORDINAL_POSITION;

-- Check wallet_transactions_t columns
SELECT 'Verifying wallet_transactions_t columns...' as status;
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'wallet_transactions_t'
ORDER BY ORDINAL_POSITION;

-- Check charging_stations_t columns
SELECT 'Verifying charging_stations_t columns...' as status;
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'charging_stations_t'
ORDER BY ORDINAL_POSITION;

-- Check station_connectors_t columns
SELECT 'Verifying station_connectors_t columns...' as status;
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'station_connectors_t'
ORDER BY ORDINAL_POSITION;

-- Check charging_sessions_t columns
SELECT 'Verifying charging_sessions_t columns...' as status;
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'charging_sessions_t'
ORDER BY ORDINAL_POSITION;

-- Check user_vehicles_t columns
SELECT 'Verifying user_vehicles_t columns...' as status;
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'user_vehicles_t'
ORDER BY ORDINAL_POSITION;

-- Check station_bookings_t columns
SELECT 'Verifying station_bookings_t columns...' as status;
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'station_bookings_t'
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
SELECT 'charging_stations_t' as table_name, COUNT(*) as record_count FROM charging_stations_t
UNION ALL
SELECT 'users_t', COUNT(*) FROM users_t
UNION ALL
SELECT 'wallet_t', COUNT(*) FROM wallet_t
UNION ALL
SELECT 'charging_sessions_t', COUNT(*) FROM charging_sessions_t;

-- Verify database character set
SELECT 'Checking Database Configuration...' as status;
SELECT 
    DEFAULT_CHARACTER_SET_NAME,
    DEFAULT_COLLATION_NAME
FROM information_schema.SCHEMATA
WHERE SCHEMA_NAME = DATABASE();

SELECT 'Schema verification complete!' as status;
