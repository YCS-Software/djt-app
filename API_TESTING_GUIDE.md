# API Testing Guide - Complete Verification

This guide helps you test all API endpoints to ensure database queries work correctly.

## Setup

1. **Start the server:**
```bash
cd server
npm start
```

2. **Verify database connection** in server logs

---

## 1. Authentication APIs

### Send OTP
```bash
POST http://localhost:3000/api/auth/sendOTP
Content-Type: application/json

{
  "phonenumber": "9666476298"
}
```

**Expected Response:**
```json
{
  "status": 200,
  "message": "OTP sent successfully",
  "data": {
    "otpID": "...",
    "usr_id": "...",
    "status": "sent"
  }
}
```

### Verify OTP
```bash
POST http://localhost:3000/api/auth/verifyOTP
Content-Type: application/json

{
  "phno": "9666476298",
  "otp": "1234",
  "otpID": "..."
}
```

---

## 2. Wallet APIs

### Get Wallet Balance
```bash
GET http://localhost:3000/api/wallet/balance
Authorization: Bearer <token>
```

**Expected:** Wallet balance with `wllt_id`, `balance`, `last_updated`

### Add Money to Wallet
```bash
POST http://localhost:3000/api/wallet/add
Authorization: Bearer <token>
Content-Type: application/json

{
  "amount": 500,
  "payment_method": "upi",
  "payment_details": {
    "upi_id": "user@upi"
  }
}
```

**Verifies Columns:** `blnce_amt`, `lst_updtd_ts`, `trxn_typ_cd`, `trxn_ctgry_cd`, `blnce_bfr_amt`, `blnce_aftr_amt`

### Get Transaction History
```bash
GET http://localhost:3000/api/wallet/transactions?limit=10&offset=0
Authorization: Bearer <token>
```

**Verifies Columns:** All wallet_transactions_t columns

---

## 3. Charging Station APIs

### Get Nearby Stations
```bash
GET http://localhost:3000/api/stations/nearby?latitude=28.4595&longitude=77.0266&radius=50
Authorization: Bearer <token>
```

**Verifies Columns:** 
- `sttn_id`, `sttn_nm_tx`, `sttn_cd`, `addr_tx`, `cty_tx`
- `ltde_nbr`, `lngtde_nbr`, `prce_per_kwh_amt`
- `ttl_chrgrs_nbr`, `avlbl_chrgrs_nbr`, `rtng_nbr`
- `is_fst_chrgng_in`, `pwr_tx`

### Get All Stations
```bash
GET http://localhost:3000/api/stations/all
Authorization: Bearer <token>
```

### Get Station Details
```bash
GET http://localhost:3000/api/stations/:stationId
Authorization: Bearer <token>
```

**Verifies Columns:** All charging_stations_t columns + connectors

### Search Stations
```bash
GET http://localhost:3000/api/stations/search?q=Mall
Authorization: Bearer <token>
```

### Add Favorite Station
```bash
POST http://localhost:3000/api/stations/favorites
Authorization: Bearer <token>
Content-Type: application/json

{
  "station_id": 1
}
```

**Verifies Table:** `user_favorite_stations_t`

### Get Favorites
```bash
GET http://localhost:3000/api/stations/favorites
Authorization: Bearer <token>
```

---

## 4. Charging Session APIs

### Start Charging Session
```bash
POST http://localhost:3000/api/sessions/start
Authorization: Bearer <token>
Content-Type: application/json

{
  "station_id": 1,
  "connector_id": 1,
  "qr_code": "QR123456"
}
```

**Verifies Columns:**
- `sssn_id`, `sssn_cd`, `usr_id`, `sttn_id`, `cnntr_id`
- `strt_ts`, `prce_per_kwh_amt`, `sttus_cd`, `pymnt_sttus_cd`

### Get Active Session
```bash
GET http://localhost:3000/api/sessions/active
Authorization: Bearer <token>
```

**Verifies Columns:** 
- `enrgy_cnsmd_kwh`, `ttl_cst_amt`, `prgrss_pct`, `durn_mnts_nbr`

### Stop Charging Session
```bash
POST http://localhost:3000/api/sessions/stop
Authorization: Bearer <token>
Content-Type: application/json

{
  "session_id": 1
}
```

**Verifies:** Session completion, wallet deduction, transaction creation

### Get Session History
```bash
GET http://localhost:3000/api/sessions/history?limit=10&offset=0&status=completed
Authorization: Bearer <token>
```

**Verifies Columns:** All charging_sessions_t query columns

### Get Session Details
```bash
GET http://localhost:3000/api/sessions/:sessionId
Authorization: Bearer <token>
```

---

## 5. Dashboard & Analytics APIs

### Get Dashboard Stats
```bash
GET http://localhost:3000/api/dashboard/stats
Authorization: Bearer <token>
```

**Verifies Query:**
```sql
SELECT 
    COUNT(sssn_id) as total_sessions,
    SUM(enrgy_cnsmd_kwh) as total_energy,
    SUM(ttl_cst_amt) as total_spent,
    SUM(enrgy_cnsmd_kwh * 0.82) as co2_saved,
    AVG(durn_mnts_nbr) as avg_duration,
    AVG(ttl_cst_amt) as avg_cost
FROM charging_sessions_t
```

### Get Monthly Analytics
```bash
GET http://localhost:3000/api/dashboard/monthly?months=6
Authorization: Bearer <token>
```

### Get Weekly Activity
```bash
GET http://localhost:3000/api/dashboard/weekly
Authorization: Bearer <token>
```

### Get Favorite Stations Analytics
```bash
GET http://localhost:3000/api/dashboard/favorite-stations
Authorization: Bearer <token>
```

---

## Common Database Errors to Check

### 1. Unknown Column Error
```
Error: Unknown column 'xyz' in 'field list'
```
**Solution:** Verify column exists in schema using `verify_schema.sql`

### 2. Table Doesn't Exist
```
Error: Table 'database.table_name' doesn't exist
```
**Solution:** Run `schema.sql` to create all tables

### 3. Foreign Key Constraint
```
Error: Cannot add or update a child row: a foreign key constraint fails
```
**Solution:** Ensure parent record exists before inserting child record

### 4. Syntax Error
```
Error: You have an error in your SQL syntax
```
**Solution:** Check for SQL Server syntax (TOP, GETDATE) - should use MySQL (LIMIT, NOW)

---

## Database Query Testing Checklist

### ✅ Users & Authentication
- [ ] `users_t` - All columns accessible
- [ ] `auth_otp_t` - OTP storage and retrieval works
- [ ] `user_tokens_t` - Token management (if used)

### ✅ Wallet & Transactions
- [ ] `wallet_t` - Balance operations work
- [ ] `wallet_transactions_t` - All transaction types (credit, debit, refund)

### ✅ Charging Stations
- [ ] `charging_stations_t` - CRUD operations
- [ ] `station_connectors_t` - Connector queries
- [ ] `user_favorite_stations_t` - Favorites work

### ✅ Charging Sessions
- [ ] `charging_sessions_t` - Session lifecycle
- [ ] `charging_session_logs_t` - Log creation (if used)

### ✅ Bookings
- [ ] `station_bookings_t` - Booking operations (if implemented)

### ✅ Vehicles
- [ ] `user_vehicles_t` - Vehicle management (if implemented)

### ✅ Statistics
- [ ] `user_statistics_t` - Stats aggregation
- [ ] Dashboard queries work correctly

### ✅ Reviews & Notifications
- [ ] `station_reviews_t` - Review operations (if implemented)
- [ ] `notifications_t` - Notification creation (if implemented)

---

## Testing Tools

### Using cURL
```bash
# Send OTP
curl -X POST http://localhost:3000/api/auth/sendOTP \
  -H "Content-Type: application/json" \
  -d '{"phonenumber":"9666476298"}'

# Get stations with token
curl -X GET http://localhost:3000/api/stations/all \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Using Postman
1. Import collection from `server/API_DOCUMENTATION.md`
2. Set environment variable for `token`
3. Run entire collection to test all endpoints

### Using Thunder Client (VS Code)
1. Install Thunder Client extension
2. Create requests for each endpoint
3. Test systematically

---

## Expected Database State After Testing

After running all tests, you should have:

1. **users_t**: Test users created
2. **wallet_t**: Wallets for test users
3. **wallet_transactions_t**: Transaction records
4. **charging_stations_t**: Sample stations (from schema.sql)
5. **charging_sessions_t**: Test session records
6. **user_favorite_stations_t**: Favorite relationships

---

## Troubleshooting

### Server won't start
- Check `.env` file for correct database credentials
- Verify MySQL is running
- Check port 3000 is not in use

### All queries failing
- Verify database connection in `server/config/database.js`
- Run `verify_schema.sql` to check tables exist
- Check MySQL user has proper permissions

### Specific endpoint failing
- Check server logs for exact error
- Verify column names in model match schema
- Test query directly in MySQL Workbench

---

## Success Criteria

✅ All endpoints return 200 for valid requests
✅ No "unknown column" errors
✅ No "table doesn't exist" errors
✅ Data persists correctly in database
✅ Foreign key relationships work
✅ Transactions maintain data integrity
