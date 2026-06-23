# DATABASE TABLE STRUCTURES

Complete reference for all database tables in the EV Charging Station application.

---

## 1. USERS & AUTHENTICATION

### Table: `usr_lst_t`
**Description**: User information and profiles

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| usr_id | INT | PRIMARY KEY, AUTO_INCREMENT | User ID |
| phn_nmbr_tx | VARCHAR(15) | NOT NULL, UNIQUE | Phone number |
| eml_tx | VARCHAR(100) | UNIQUE | Email address |
| nm_tx | VARCHAR(100) | | Full name |
| prfl_img_tx | VARCHAR(255) | | Profile image URL |
| usr_typ_cd | VARCHAR(20) | DEFAULT 'customer' | User type (customer/admin/operator) |
| a_in | TINYINT(1) | DEFAULT 1 | Active indicator |
| i_ts | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Insert timestamp |
| u_ts | TIMESTAMP | ON UPDATE CURRENT_TIMESTAMP | Update timestamp |
| d_ts | TIMESTAMP | NULL | Delete timestamp |
| insrt_usr_id | INT | DEFAULT 1 | Created by user ID |
| updte_usr_id | INT | NULL | Updated by user ID |

**Indexes**: `idx_phone`, `idx_email`, `idx_active`

---

### Table: `otp_lst_t`
**Description**: OTP authentication records

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| otp_id | INT | PRIMARY KEY, AUTO_INCREMENT | OTP record ID |
| phn_nmbr_tx | VARCHAR(15) | NOT NULL | Phone number |
| otp_tx | VARCHAR(6) | NOT NULL | OTP code |
| expry_ts | TIMESTAMP | NOT NULL | OTP expiry time |
| attmpts_nbr | INT | DEFAULT 0 | Verification attempts |
| is_vrfd_in | TINYINT(1) | DEFAULT 0 | Is verified |
| vrfd_ts | TIMESTAMP | NULL | Verified timestamp |
| a_in | TINYINT(1) | DEFAULT 1 | Active indicator |
| i_ts | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Created timestamp |

**Indexes**: `idx_phone`, `idx_expiry`, `idx_verified`

---

### Table: `tkn_lst_t`
**Description**: JWT token management

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| tkn_id | INT | PRIMARY KEY, AUTO_INCREMENT | Token ID |
| usr_id | INT | NOT NULL, FK(usr_lst_t) | User ID |
| tkn_tx | TEXT | NOT NULL | Token string |
| tkn_typ_cd | VARCHAR(20) | DEFAULT 'access' | Token type |
| expry_ts | TIMESTAMP | NOT NULL | Expiry timestamp |
| is_rvkd_in | TINYINT(1) | DEFAULT 0 | Is revoked |
| a_in | TINYINT(1) | DEFAULT 1 | Active indicator |
| i_ts | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Created timestamp |

**Indexes**: `idx_user`, `idx_expiry`

---

## 2. WALLET & TRANSACTIONS

### Table: `wllt_lst_t`
**Description**: User wallet balances

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| wllt_id | INT | PRIMARY KEY, AUTO_INCREMENT | Wallet ID |
| usr_id | INT | NOT NULL, UNIQUE, FK(usr_lst_t) | User ID |
| blnce_amt | DECIMAL(10,2) | DEFAULT 0.00 | Current balance |
| lst_updtd_ts | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Last updated |
| a_in | TINYINT(1) | DEFAULT 1 | Active indicator |
| i_ts | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Created timestamp |
| u_ts | TIMESTAMP | ON UPDATE CURRENT_TIMESTAMP | Updated timestamp |

**Indexes**: `idx_user`

---

### Table: `trxn_lst_t`
**Description**: Wallet transaction history

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| trxn_id | INT | PRIMARY KEY, AUTO_INCREMENT | Transaction ID |
| wllt_id | INT | NOT NULL, FK(wllt_lst_t) | Wallet ID |
| usr_id | INT | NOT NULL, FK(usr_lst_t) | User ID |
| trxn_typ_cd | VARCHAR(20) | NOT NULL | Type (credit/debit/refund) |
| trxn_ctgry_cd | VARCHAR(30) | NOT NULL | Category (charging/topup/transfer) |
| amt | DECIMAL(10,2) | NOT NULL | Transaction amount |
| blnce_bfr_amt | DECIMAL(10,2) | NOT NULL | Balance before |
| blnce_aftr_amt | DECIMAL(10,2) | NOT NULL | Balance after |
| dscrptn_tx | TEXT | | Description |
| ref_id | VARCHAR(100) | | Reference ID |
| ref_typ_cd | VARCHAR(30) | | Reference type |
| pymnt_mthd_cd | VARCHAR(30) | | Payment method (upi/card/netbanking) |
| pymnt_dtls_json | JSON | | Payment details |
| sttus_cd | VARCHAR(20) | DEFAULT 'completed' | Status |
| a_in | TINYINT(1) | DEFAULT 1 | Active indicator |
| i_ts | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Created timestamp |

**Indexes**: `idx_wallet`, `idx_user`, `idx_type`, `idx_category`, `idx_date`

---

## 3. CHARGING STATIONS

### Table: `sttn_lst_t`
**Description**: Charging station information

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| sttn_id | INT | PRIMARY KEY, AUTO_INCREMENT | Station ID |
| sttn_nm_tx | VARCHAR(200) | NOT NULL | Station name |
| sttn_cd | VARCHAR(50) | UNIQUE, NOT NULL | Station code |
| addr_tx | TEXT | NOT NULL | Address |
| cty_tx | VARCHAR(100) | | City |
| stte_tx | VARCHAR(100) | | State |
| pstl_cd_tx | VARCHAR(10) | | Postal code |
| ltde_nbr | DECIMAL(10,8) | | Latitude |
| lngtde_nbr | DECIMAL(11,8) | | Longitude |
| prce_per_kwh_amt | DECIMAL(8,2) | NOT NULL | Price per kWh |
| ttl_chrgrs_nbr | INT | DEFAULT 1 | Total chargers |
| avlbl_chrgrs_nbr | INT | DEFAULT 1 | Available chargers |
| rtng_nbr | DECIMAL(3,2) | DEFAULT 0.00 | Average rating |
| ttl_rtngs_nbr | INT | DEFAULT 0 | Total ratings count |
| is_fst_chrgng_in | TINYINT(1) | DEFAULT 0 | Fast charging available |
| pwr_tx | VARCHAR(20) | | Power rating (150kW, etc) |
| oprtr_nm_tx | VARCHAR(100) | | Operator name |
| cntct_nbr_tx | VARCHAR(15) | | Contact number |
| oprng_hrs_json | JSON | | Operating hours |
| amnties_json | JSON | | Amenities |
| a_in | TINYINT(1) | DEFAULT 1 | Active indicator |
| i_ts | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Created timestamp |
| u_ts | TIMESTAMP | ON UPDATE CURRENT_TIMESTAMP | Updated timestamp |

**Indexes**: `idx_code`, `idx_location`, `idx_city`, `idx_active`

---

### Table: `cnntr_lst_t`
**Description**: Station connector types

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| cnntr_id | INT | PRIMARY KEY, AUTO_INCREMENT | Connector ID |
| sttn_id | INT | NOT NULL, FK(sttn_lst_t) | Station ID |
| cnntr_typ_cd | VARCHAR(30) | NOT NULL | Connector type (CCS2/CHAdeMO/Type2) |
| cnntr_nm_tx | VARCHAR(50) | | Connector name |
| pwr_tx | VARCHAR(20) | | Power rating |
| is_avlbl_in | TINYINT(1) | DEFAULT 1 | Is available |
| a_in | TINYINT(1) | DEFAULT 1 | Active indicator |
| i_ts | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Created timestamp |

**Indexes**: `idx_station`, `idx_type`

---

### Table: `fvrt_lst_t`
**Description**: User favorite stations

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| fvrt_id | INT | PRIMARY KEY, AUTO_INCREMENT | Favorite ID |
| usr_id | INT | NOT NULL, FK(usr_lst_t) | User ID |
| sttn_id | INT | NOT NULL, FK(sttn_lst_t) | Station ID |
| a_in | TINYINT(1) | DEFAULT 1 | Active indicator |
| i_ts | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Created timestamp |

**Unique Key**: `unique_user_station(usr_id, sttn_id)`
**Indexes**: `idx_user`, `idx_station`

---

## 4. CHARGING SESSIONS

### Table: `sssn_lst_t`
**Description**: Charging session records

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| sssn_id | INT | PRIMARY KEY, AUTO_INCREMENT | Session ID |
| sssn_cd | VARCHAR(50) | UNIQUE, NOT NULL | Session code |
| usr_id | INT | NOT NULL, FK(usr_lst_t) | User ID |
| sttn_id | INT | NOT NULL, FK(sttn_lst_t) | Station ID |
| cnntr_id | INT | NOT NULL, FK(cnntr_lst_t) | Connector ID |
| strt_ts | TIMESTAMP | NULL | Start time |
| end_ts | TIMESTAMP | NULL | End time |
| durn_mnts_nbr | INT | | Duration in minutes |
| enrgy_cnsmd_kwh | DECIMAL(10,3) | DEFAULT 0 | Energy consumed (kWh) |
| prce_per_kwh_amt | DECIMAL(8,2) | | Price per kWh |
| ttl_cst_amt | DECIMAL(10,2) | DEFAULT 0 | Total cost |
| prgrss_pct | INT | DEFAULT 0 | Progress percentage |
| sttus_cd | VARCHAR(20) | DEFAULT 'initiated' | Status (initiated/active/completed/cancelled/failed) |
| pymnt_sttus_cd | VARCHAR(20) | DEFAULT 'pending' | Payment status (pending/paid/refunded) |
| wllt_trxn_id | INT | NULL, FK(trxn_lst_t) | Wallet transaction ID |
| qr_cd_tx | VARCHAR(100) | | QR code scanned |
| a_in | TINYINT(1) | DEFAULT 1 | Active indicator |
| i_ts | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Created timestamp |
| u_ts | TIMESTAMP | ON UPDATE CURRENT_TIMESTAMP | Updated timestamp |

**Indexes**: `idx_user`, `idx_station`, `idx_status`, `idx_date`, `idx_session_code`

---

### Table: `sssn_log_lst_t`
**Description**: Real-time charging session logs

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| log_id | INT | PRIMARY KEY, AUTO_INCREMENT | Log ID |
| sssn_id | INT | NOT NULL, FK(sssn_lst_t) | Session ID |
| prgrss_pct | INT | DEFAULT 0 | Progress percentage |
| enrgy_cnsmd_kwh | DECIMAL(10,3) | | Energy consumed |
| crnt_cst_amt | DECIMAL(10,2) | | Current cost |
| bttry_lvl_pct | INT | | Battery level % |
| log_ts | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Log timestamp |

**Indexes**: `idx_session`, `idx_timestamp`

---

## 5. BOOKINGS

### Table: `bkng_lst_t`
**Description**: Station booking reservations

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| bkng_id | INT | PRIMARY KEY, AUTO_INCREMENT | Booking ID |
| bkng_cd | VARCHAR(50) | UNIQUE, NOT NULL | Booking code |
| usr_id | INT | NOT NULL, FK(usr_lst_t) | User ID |
| sttn_id | INT | NOT NULL, FK(sttn_lst_t) | Station ID |
| cnntr_id | INT | NULL, FK(cnntr_lst_t) | Connector ID |
| bkng_dte | DATE | NOT NULL | Booking date |
| bkng_tm | TIME | NOT NULL | Booking time |
| durn_mnts_nbr | INT | NOT NULL | Duration in minutes |
| sttus_cd | VARCHAR(20) | DEFAULT 'confirmed' | Status (confirmed/cancelled/completed/expired) |
| cncltn_rsn_tx | TEXT | | Cancellation reason |
| cnclld_ts | TIMESTAMP | NULL | Cancelled timestamp |
| a_in | TINYINT(1) | DEFAULT 1 | Active indicator |
| i_ts | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Created timestamp |
| u_ts | TIMESTAMP | ON UPDATE CURRENT_TIMESTAMP | Updated timestamp |

**Indexes**: `idx_user`, `idx_station`, `idx_date`, `idx_status`

---

## 6. USER VEHICLES

### Table: `vhcl_lst_t`
**Description**: User vehicle information

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| vhcl_id | INT | PRIMARY KEY, AUTO_INCREMENT | Vehicle ID |
| usr_id | INT | NOT NULL, FK(usr_lst_t) | User ID |
| vhcl_nm_tx | VARCHAR(100) | | Vehicle name/alias |
| mke_tx | VARCHAR(50) | | Make (Tesla, Tata, etc) |
| mdl_tx | VARCHAR(50) | | Model |
| yr_nbr | INT | | Year |
| rg_nbr_tx | VARCHAR(20) | | Registration number |
| bttry_cpcty_kwh | DECIMAL(8,2) | | Battery capacity (kWh) |
| cnntr_typ_cd | VARCHAR(30) | | Compatible connector type |
| is_dflt_in | TINYINT(1) | DEFAULT 0 | Is default vehicle |
| a_in | TINYINT(1) | DEFAULT 1 | Active indicator |
| i_ts | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Created timestamp |
| u_ts | TIMESTAMP | ON UPDATE CURRENT_TIMESTAMP | Updated timestamp |

**Indexes**: `idx_user`, `idx_default`

---

## 7. RATINGS & REVIEWS

### Table: `rvw_lst_t`
**Description**: Station ratings and reviews

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| rvw_id | INT | PRIMARY KEY, AUTO_INCREMENT | Review ID |
| usr_id | INT | NOT NULL, FK(usr_lst_t) | User ID |
| sttn_id | INT | NOT NULL, FK(sttn_lst_t) | Station ID |
| sssn_id | INT | NULL, FK(sssn_lst_t) | Session ID |
| rtng_nbr | INT | NOT NULL | Rating (1-5) |
| rvw_tx | TEXT | | Review text |
| a_in | TINYINT(1) | DEFAULT 1 | Active indicator |
| i_ts | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Created timestamp |
| u_ts | TIMESTAMP | ON UPDATE CURRENT_TIMESTAMP | Updated timestamp |

**Indexes**: `idx_user`, `idx_station`, `idx_rating`

---

## 8. NOTIFICATIONS

### Table: `ntfctn_lst_t`
**Description**: User notifications

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| ntfctn_id | INT | PRIMARY KEY, AUTO_INCREMENT | Notification ID |
| usr_id | INT | NOT NULL, FK(usr_lst_t) | User ID |
| ttl_tx | VARCHAR(200) | NOT NULL | Title |
| msg_tx | TEXT | NOT NULL | Message |
| typ_cd | VARCHAR(30) | | Type (session/wallet/booking/system) |
| ref_id | INT | NULL | Reference ID |
| ref_typ_cd | VARCHAR(30) | | Reference type |
| is_rd_in | TINYINT(1) | DEFAULT 0 | Is read |
| rd_ts | TIMESTAMP | NULL | Read timestamp |
| a_in | TINYINT(1) | DEFAULT 1 | Active indicator |
| i_ts | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Created timestamp |

**Indexes**: `idx_user`, `idx_read`, `idx_date`

---

## 9. OFFERS & REWARDS

### Table: `offr_lst_t`
**Description**: Promotional offers

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| offr_id | INT | PRIMARY KEY, AUTO_INCREMENT | Offer ID |
| offr_cd | VARCHAR(50) | UNIQUE, NOT NULL | Offer code |
| ttl_tx | VARCHAR(200) | NOT NULL | Title |
| dscrptn_tx | TEXT | | Description |
| dscnt_typ_cd | VARCHAR(20) | | Discount type (percentage/flat) |
| dscnt_vl | DECIMAL(10,2) | | Discount value |
| mx_dscnt_amt | DECIMAL(10,2) | | Max discount amount |
| mn_trxn_amt | DECIMAL(10,2) | | Min transaction amount |
| strt_dte | DATE | | Start date |
| end_dte | DATE | | End date |
| mx_uses_nbr | INT | | Max uses per user |
| a_in | TINYINT(1) | DEFAULT 1 | Active indicator |
| i_ts | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Created timestamp |
| u_ts | TIMESTAMP | ON UPDATE CURRENT_TIMESTAMP | Updated timestamp |

**Indexes**: `idx_code`, `idx_dates`

---

### Table: `usg_lst_t`
**Description**: User offer usage tracking

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| usg_id | INT | PRIMARY KEY, AUTO_INCREMENT | Usage ID |
| usr_id | INT | NOT NULL, FK(usr_lst_t) | User ID |
| offr_id | INT | NOT NULL, FK(offr_lst_t) | Offer ID |
| sssn_id | INT | NULL, FK(sssn_lst_t) | Session ID |
| dscnt_amt | DECIMAL(10,2) | | Discount amount |
| i_ts | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Created timestamp |

**Indexes**: `idx_user`, `idx_offer`

---

## 10. STATISTICS & ANALYTICS

### Table: `stt_lst_t`
**Description**: User aggregated statistics

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| stt_id | INT | PRIMARY KEY, AUTO_INCREMENT | Statistic ID |
| usr_id | INT | NOT NULL, UNIQUE, FK(usr_lst_t) | User ID |
| ttl_sssns_nbr | INT | DEFAULT 0 | Total sessions |
| ttl_enrgy_kwh | DECIMAL(12,3) | DEFAULT 0 | Total energy consumed |
| ttl_spnt_amt | DECIMAL(12,2) | DEFAULT 0 | Total spent |
| co2_svd_kg | DECIMAL(10,2) | DEFAULT 0 | CO2 saved (kg) |
| avg_sssn_durn_mnts | INT | DEFAULT 0 | Avg session duration |
| avg_sssn_cst_amt | DECIMAL(10,2) | DEFAULT 0 | Avg session cost |
| lst_updtd_ts | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Last updated |

**Indexes**: `idx_user`

---

## 11. AUDIT & LOGS

### Table: `audt_lst_t`
**Description**: Audit trail logs

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| log_id | INT | PRIMARY KEY, AUTO_INCREMENT | Log ID |
| usr_id | INT | NULL | User ID |
| actn_cd | VARCHAR(50) | NOT NULL | Action code |
| entty_typ_cd | VARCHAR(50) | | Entity type |
| entty_id | INT | NULL | Entity ID |
| old_vl_json | JSON | | Old values |
| nw_vl_json | JSON | | New values |
| ip_addr_tx | VARCHAR(45) | | IP address |
| usr_agnt_tx | TEXT | | User agent |
| i_ts | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Created timestamp |

**Indexes**: `idx_user`, `idx_action`, `idx_date`

---

## 12. SETTINGS

### Table: `sttng_lst_t`
**Description**: Application settings

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| sttng_id | INT | PRIMARY KEY, AUTO_INCREMENT | Setting ID |
| sttng_ky_tx | VARCHAR(100) | UNIQUE, NOT NULL | Setting key |
| sttng_vl_tx | TEXT | | Setting value |
| dscrptn_tx | VARCHAR(255) | | Description |
| a_in | TINYINT(1) | DEFAULT 1 | Active indicator |
| i_ts | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Created timestamp |
| u_ts | TIMESTAMP | ON UPDATE CURRENT_TIMESTAMP | Updated timestamp |

**Indexes**: `idx_key`

---

### Table: `prf_lst_t`
**Description**: User preferences

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| prf_id | INT | PRIMARY KEY, AUTO_INCREMENT | Preference ID |
| usr_id | INT | NOT NULL, UNIQUE, FK(usr_lst_t) | User ID |
| lng_cd | VARCHAR(10) | DEFAULT 'en' | Language code |
| ntfctn_enbl_in | TINYINT(1) | DEFAULT 1 | Notifications enabled |
| lc_shre_in | TINYINT(1) | DEFAULT 1 | Location sharing enabled |
| prfrncs_json | JSON | | Additional preferences |
| i_ts | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Created timestamp |
| u_ts | TIMESTAMP | ON UPDATE CURRENT_TIMESTAMP | Updated timestamp |

**Indexes**: `idx_user`

---

## NAMING CONVENTIONS

### Field Suffixes:
- `_id` - Primary/Foreign keys (e.g., `usr_id`, `sttn_id`)
- `_tx` - Text/String fields (e.g., `nm_tx`, `addr_tx`)
- `_nbr` - Numeric fields (e.g., `phn_nmbr_tx`, `prgrss_pct`)
- `_amt` - Amount/Money fields (e.g., `blnce_amt`, `ttl_cst_amt`)
- `_ts` - Timestamp fields (e.g., `i_ts`, `u_ts`, `d_ts`)
- `_in` - Indicator/Boolean (e.g., `a_in`, `is_vrfd_in`)
- `_cd` - Code/Enum fields (e.g., `sttus_cd`, `typ_cd`)
- `_json` - JSON fields (e.g., `pymnt_dtls_json`)

### Common Fields:
- `a_in` - Active indicator (1=active, 0=inactive)
- `i_ts` - Insert timestamp (created_at)
- `u_ts` - Update timestamp (updated_at)
- `d_ts` - Delete timestamp (soft delete)
- `insrt_usr_id` - Created by user ID
- `updte_usr_id` - Updated by user ID

---

## RELATIONSHIPS

### One-to-One:
- usr_lst_t → wllt_lst_t
- usr_lst_t → stt_lst_t
- usr_lst_t → prf_lst_t

### One-to-Many:
- usr_lst_t → sssn_lst_t
- usr_lst_t → bkng_lst_t
- usr_lst_t → vhcl_lst_t
- usr_lst_t → trxn_lst_t
- sttn_lst_t → cnntr_lst_t
- sttn_lst_t → sssn_lst_t
- sssn_lst_t → sssn_log_lst_t

### Many-to-Many:
- usr_lst_t ←→ sttn_lst_t (via fvrt_lst_t)

---

## DATA TYPES REFERENCE

- **INT** - Integer (4 bytes)
- **TINYINT(1)** - Boolean (0 or 1)
- **VARCHAR(n)** - Variable character string (max n chars)
- **TEXT** - Long text
- **DECIMAL(p,s)** - Decimal number (p=precision, s=scale)
- **TIMESTAMP** - Date and time
- **DATE** - Date only
- **TIME** - Time only
- **JSON** - JSON data

---

This structure supports all functionality shown in the application screens including:
- ✅ User authentication via OTP
- ✅ Wallet management and transactions
- ✅ Charging station search and favorites
- ✅ Charging session management
- ✅ Station bookings
- ✅ User vehicles
- ✅ Dashboard analytics
- ✅ Ratings and reviews
- ✅ Notifications
- ✅ Offers and rewards
