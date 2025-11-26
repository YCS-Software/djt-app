# Database Column Reference Guide

Complete mapping of all database columns used across the application.

---

## 1. users_t (User Information)

| Column Name | Type | API Field | Description |
|------------|------|-----------|-------------|
| `usr_id` | INT | `usr_id` | Primary key - User ID |
| `phn_nmbr_tx` | VARCHAR(15) | `phone_number` | User phone number (unique) |
| `eml_tx` | VARCHAR(100) | `email` | User email address |
| `nm_tx` | VARCHAR(100) | `name` | User full name |
| `prfl_img_tx` | VARCHAR(255) | `profile_image` | Profile image URL |
| `usr_typ_cd` | VARCHAR(20) | `user_type` | customer/admin/operator |
| `a_in` | TINYINT(1) | - | Active indicator (1=active, 0=inactive) |
| `i_ts` | TIMESTAMP | `created_at` | Insert timestamp |
| `u_ts` | TIMESTAMP | `updated_at` | Update timestamp |
| `d_ts` | TIMESTAMP | `deleted_at` | Delete timestamp |
| `insrt_usr_id` | INT | - | User who created record |
| `updte_usr_id` | INT | - | User who updated record |

**Used In:** userModel.js, authAppCtrl.js

---

## 2. auth_otp_t (OTP Authentication)

| Column Name | Type | API Field | Description |
|------------|------|-----------|-------------|
| `otp_id` | INT | `otp_id` | Primary key - OTP ID |
| `phn_nmbr_tx` | VARCHAR(15) | `phone_number` | Phone number for OTP |
| `otp_tx` | VARCHAR(6) | `otp` | 6-digit OTP code |
| `expry_ts` | TIMESTAMP | `expires_at` | OTP expiry time |
| `attmpts_nbr` | INT | `attempts` | Verification attempt count |
| `is_vrfd_in` | TINYINT(1) | `is_verified` | Verification status |
| `vrfd_ts` | TIMESTAMP | `verified_at` | Verification timestamp |
| `a_in` | TINYINT(1) | - | Active indicator |
| `i_ts` | TIMESTAMP | `created_at` | Creation timestamp |

**Used In:** authModel.js ✅ FIXED (was using SQL Server syntax)

---

## 3. wallet_t (User Wallet)

| Column Name | Type | API Field | Description |
|------------|------|-----------|-------------|
| `wllt_id` | INT | `wallet_id` | Primary key - Wallet ID |
| `usr_id` | INT | `user_id` | Foreign key to users_t |
| `blnce_amt` | DECIMAL(10,2) | `balance` | Current wallet balance |
| `lst_updtd_ts` | TIMESTAMP | `last_updated` | Last update time |
| `a_in` | TINYINT(1) | - | Active indicator |
| `i_ts` | TIMESTAMP | `created_at` | Creation timestamp |
| `u_ts` | TIMESTAMP | `updated_at` | Update timestamp |

**Used In:** walletModel.js, walletCtrl.js

---

## 4. wallet_transactions_t (Transaction History)

| Column Name | Type | API Field | Description |
|------------|------|-----------|-------------|
| `trxn_id` | INT | `transaction_id` | Primary key - Transaction ID |
| `wllt_id` | INT | `wallet_id` | Foreign key to wallet_t |
| `usr_id` | INT | `user_id` | Foreign key to users_t |
| `trxn_typ_cd` | VARCHAR(20) | `type` | credit/debit/refund |
| `trxn_ctgry_cd` | VARCHAR(30) | `category` | charging/topup/transfer/refund |
| `amt` | DECIMAL(10,2) | `amount` | Transaction amount |
| `blnce_bfr_amt` | DECIMAL(10,2) | `balance_before` | Balance before transaction |
| `blnce_aftr_amt` | DECIMAL(10,2) | `balance_after` | Balance after transaction |
| `dscrptn_tx` | TEXT | `description` | Transaction description |
| `ref_id` | VARCHAR(100) | `reference_id` | Reference ID (session/payment) |
| `ref_typ_cd` | VARCHAR(30) | `reference_type` | session/payment/transfer |
| `pymnt_mthd_cd` | VARCHAR(30) | `payment_method` | upi/card/netbanking |
| `pymnt_dtls_json` | JSON | `payment_details` | Payment details JSON |
| `sttus_cd` | VARCHAR(20) | `status` | pending/completed/failed |
| `a_in` | TINYINT(1) | - | Active indicator |
| `i_ts` | TIMESTAMP | `created_at` | Transaction time |

**Used In:** walletModel.js, sessionCtrl.js, walletCtrl.js

---

## 5. charging_stations_t (Charging Stations)

| Column Name | Type | API Field | Description |
|------------|------|-----------|-------------|
| `sttn_id` | INT | `station_id` | Primary key - Station ID |
| `sttn_nm_tx` | VARCHAR(200) | `name` | Station name |
| `sttn_cd` | VARCHAR(50) | `code` | Unique station code |
| `addr_tx` | TEXT | `address` | Full address |
| `cty_tx` | VARCHAR(100) | `city` | City name |
| `stte_tx` | VARCHAR(100) | `state` | State name |
| `pstl_cd_tx` | VARCHAR(10) | `postal_code` | Postal/ZIP code |
| `ltde_nbr` | DECIMAL(10,8) | `latitude` | GPS latitude |
| `lngtde_nbr` | DECIMAL(11,8) | `longitude` | GPS longitude |
| `prce_per_kwh_amt` | DECIMAL(8,2) | `price_per_kwh` | Price per kWh |
| `ttl_chrgrs_nbr` | INT | `total_chargers` | Total charger count |
| `avlbl_chrgrs_nbr` | INT | `available_chargers` | Available charger count |
| `rtng_nbr` | DECIMAL(3,2) | `rating` | Average rating (0-5) |
| `ttl_rtngs_nbr` | INT | `total_ratings` | Total rating count |
| `is_fst_chrgng_in` | TINYINT(1) | `is_fast_charging` | Fast charging available |
| `pwr_tx` | VARCHAR(20) | `power` | Power rating (150kW) |
| `oprtr_nm_tx` | VARCHAR(100) | `operator_name` | Operator name |
| `cntct_nbr_tx` | VARCHAR(15) | `contact_number` | Contact phone |
| `oprng_hrs_json` | JSON | `operating_hours` | Operating hours JSON |
| `amnties_json` | JSON | `amenities` | Amenities JSON |
| `a_in` | TINYINT(1) | - | Active indicator |
| `i_ts` | TIMESTAMP | `created_at` | Creation time |
| `u_ts` | TIMESTAMP | `updated_at` | Update time |

**Used In:** stationModel.js, stationCtrl.js, sessionCtrl.js

---

## 6. station_connectors_t (Connector Types)

| Column Name | Type | API Field | Description |
|------------|------|-----------|-------------|
| `cnntr_id` | INT | `connector_id` | Primary key - Connector ID |
| `sttn_id` | INT | `station_id` | Foreign key to charging_stations_t |
| `cnntr_typ_cd` | VARCHAR(30) | `type` | CCS2/CHAdeMO/Type2 |
| `cnntr_nm_tx` | VARCHAR(50) | `name` | Connector name |
| `pwr_tx` | VARCHAR(20) | `power` | Power rating |
| `is_avlbl_in` | TINYINT(1) | `is_available` | Availability status |
| `a_in` | TINYINT(1) | - | Active indicator |
| `i_ts` | TIMESTAMP | `created_at` | Creation time |

**Used In:** stationModel.js, sessionCtrl.js

---

## 7. user_favorite_stations_t (User Favorites)

| Column Name | Type | API Field | Description |
|------------|------|-----------|-------------|
| `fvrt_id` | INT | `favorite_id` | Primary key |
| `usr_id` | INT | `user_id` | Foreign key to users_t |
| `sttn_id` | INT | `station_id` | Foreign key to charging_stations_t |
| `a_in` | TINYINT(1) | - | Active indicator |
| `i_ts` | TIMESTAMP | `favorited_at` | When favorited |

**Used In:** stationModel.js, stationCtrl.js

---

## 8. charging_sessions_t (Charging Sessions)

| Column Name | Type | API Field | Description |
|------------|------|-----------|-------------|
| `sssn_id` | INT | `session_id` | Primary key - Session ID |
| `sssn_cd` | VARCHAR(50) | `session_code` | Unique session code |
| `usr_id` | INT | `user_id` | Foreign key to users_t |
| `sttn_id` | INT | `station_id` | Foreign key to charging_stations_t |
| `cnntr_id` | INT | `connector_id` | Foreign key to station_connectors_t |
| `strt_ts` | TIMESTAMP | `start_time` | Session start time |
| `end_ts` | TIMESTAMP | `end_time` | Session end time |
| `durn_mnts_nbr` | INT | `duration_minutes` | Session duration |
| `enrgy_cnsmd_kwh` | DECIMAL(10,3) | `energy_consumed` | Energy in kWh |
| `prce_per_kwh_amt` | DECIMAL(8,2) | `price_per_kwh` | Price per kWh |
| `ttl_cst_amt` | DECIMAL(10,2) | `total_cost` | Total cost |
| `prgrss_pct` | INT | `progress` | Charging progress % |
| `sttus_cd` | VARCHAR(20) | `status` | initiated/active/completed/cancelled/failed |
| `pymnt_sttus_cd` | VARCHAR(20) | `payment_status` | pending/paid/refunded |
| `wllt_trxn_id` | INT | `wallet_transaction_id` | FK to wallet_transactions_t |
| `qr_cd_tx` | VARCHAR(100) | `qr_code` | QR code scanned |
| `a_in` | TINYINT(1) | - | Active indicator |
| `i_ts` | TIMESTAMP | `created_at` | Creation time |
| `u_ts` | TIMESTAMP | `updated_at` | Update time |

**Used In:** sessionModel.js, sessionCtrl.js, statisticsModel.js

---

## 9. charging_session_logs_t (Session Logs)

| Column Name | Type | API Field | Description |
|------------|------|-----------|-------------|
| `log_id` | INT | `log_id` | Primary key |
| `sssn_id` | INT | `session_id` | Foreign key to charging_sessions_t |
| `prgrss_pct` | INT | `progress` | Progress percentage |
| `enrgy_cnsmd_kwh` | DECIMAL(10,3) | `energy_consumed` | Energy consumed |
| `crnt_cst_amt` | DECIMAL(10,2) | `current_cost` | Current cost |
| `bttry_lvl_pct` | INT | `battery_level` | Battery level % |
| `log_ts` | TIMESTAMP | `logged_at` | Log timestamp |

**Used In:** sessionModel.js

---

## 10. station_bookings_t (Station Bookings)

| Column Name | Type | API Field | Description |
|------------|------|-----------|-------------|
| `bkng_id` | INT | `booking_id` | Primary key |
| `bkng_cd` | VARCHAR(50) | `booking_code` | Unique booking code |
| `usr_id` | INT | `user_id` | Foreign key to users_t |
| `sttn_id` | INT | `station_id` | Foreign key to charging_stations_t |
| `cnntr_id` | INT | `connector_id` | Foreign key (nullable) |
| `bkng_dte` | DATE | `booking_date` | Booking date |
| `bkng_tm` | TIME | `booking_time` | Booking time |
| `durn_mnts_nbr` | INT | `duration_minutes` | Booking duration |
| `sttus_cd` | VARCHAR(20) | `status` | confirmed/cancelled/completed/expired |
| `cncltn_rsn_tx` | TEXT | `cancellation_reason` | Cancellation reason |
| `cnclld_ts` | TIMESTAMP | `cancelled_at` | Cancellation time |
| `a_in` | TINYINT(1) | - | Active indicator |
| `i_ts` | TIMESTAMP | `created_at` | Creation time |
| `u_ts` | TIMESTAMP | `updated_at` | Update time |

**Used In:** bookingModel.js

---

## 11. user_vehicles_t (User Vehicles)

| Column Name | Type | API Field | Description |
|------------|------|-----------|-------------|
| `vhcl_id` | INT | `vehicle_id` | Primary key |
| `usr_id` | INT | `user_id` | Foreign key to users_t |
| `vhcl_nm_tx` | VARCHAR(100) | `vehicle_name` | Vehicle nickname |
| `mke_tx` | VARCHAR(50) | `make` | Tesla, Tata, etc |
| `mdl_tx` | VARCHAR(50) | `model` | Model name |
| `yr_nbr` | INT | `year` | Manufacturing year |
| `rg_nbr_tx` | VARCHAR(20) | `registration_number` | Registration number |
| `bttry_cpcty_kwh` | DECIMAL(8,2) | `battery_capacity` | Battery capacity kWh |
| `cnntr_typ_cd` | VARCHAR(30) | `connector_type` | Compatible connector |
| `is_dflt_in` | TINYINT(1) | `is_default` | Default vehicle flag |
| `a_in` | TINYINT(1) | - | Active indicator |
| `i_ts` | TIMESTAMP | `created_at` | Creation time |
| `u_ts` | TIMESTAMP | `updated_at` | Update time |

**Used In:** vehicleModel.js

---

## 12. user_statistics_t (User Statistics)

| Column Name | Type | API Field | Description |
|------------|------|-----------|-------------|
| `stt_id` | INT | `stats_id` | Primary key |
| `usr_id` | INT | `user_id` | Foreign key to users_t (unique) |
| `ttl_sssns_nbr` | INT | `total_sessions` | Total sessions count |
| `ttl_enrgy_kwh` | DECIMAL(12,3) | `total_energy_kwh` | Total energy consumed |
| `ttl_spnt_amt` | DECIMAL(12,2) | `total_spent` | Total amount spent |
| `co2_svd_kg` | DECIMAL(10,2) | `co2_saved_kg` | CO2 saved in kg |
| `avg_sssn_durn_mnts` | INT | `avg_session_duration` | Avg session duration |
| `avg_sssn_cst_amt` | DECIMAL(10,2) | `avg_session_cost` | Avg session cost |
| `lst_updtd_ts` | TIMESTAMP | `last_updated` | Last update time |

**Used In:** statisticsModel.js, dashboardCtrl.js

---

## Common Naming Conventions

### Column Suffixes
- `_tx` = Text field (VARCHAR, TEXT)
- `_nbr` = Number field (INT, DECIMAL)
- `_amt` = Amount/Money (DECIMAL)
- `_cd` = Code (VARCHAR - for status codes, type codes)
- `_in` = Indicator (TINYINT - boolean 0/1)
- `_ts` = Timestamp (TIMESTAMP, DATETIME)
- `_dte` = Date only (DATE)
- `_tm` = Time only (TIME)
- `_json` = JSON field
- `_id` = ID field (INT - primary or foreign key)

### Standard Columns
- `a_in` = Active indicator (1=active, 0=deleted/inactive)
- `i_ts` = Insert timestamp (when created)
- `u_ts` = Update timestamp (when last modified)
- `d_ts` = Delete timestamp (soft delete time)

### Prefix Meanings
- `usr` = User
- `sttn` = Station
- `sssn` = Session
- `trxn` = Transaction
- `wllt` = Wallet
- `bkng` = Booking
- `cnntr` = Connector
- `vhcl` = Vehicle
- `ntfctn` = Notification
- `offr` = Offer
- `rvw` = Review

---

## All Database Issues - RESOLVED ✅

### Issue Found:
**authModel.js used SQL Server syntax instead of MySQL**

### Fixed:
- `SELECT TOP 1` → `SELECT ... LIMIT 1`
- `GETDATE()` → `NOW()`
- All queries now use MySQL syntax

### Result:
✅ All models now compatible with MySQL
✅ All column names match schema perfectly
✅ No unknown column errors expected
✅ All foreign keys properly referenced
