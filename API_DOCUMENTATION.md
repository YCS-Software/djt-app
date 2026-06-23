# EV CHARGING STATION - API DOCUMENTATION

Complete API reference for the EV Charging Station application.

**Base URL**: `http://localhost:5000/api`

---

## Authentication

### 1. Send OTP
**POST** `/auth/app/otp`

Send OTP to user's mobile number for login.

**Request Body**:
```json
{
  "phonenumber": "9666476298"
}
```

**Response** (200):
```json
{
  "status": 200,
  "message": "OTP sent successfully",
  "data": {
    "otpID": "123",
    "usr_id": "456",
    "dev_otp": "1234"
  }
}
```

### 2. Verify OTP
**POST** `/auth/app/verify/otp`

Verify OTP and login user.

**Request Body**:
```json
{
  "phno": "9666476298",
  "otp": "1234",
  "otpID": "123",
  "usr_id": "456"
}
```

**Response** (200):
```json
{
  "status": 200,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "data": {
    "user": {
      "usr_id": 456,
      "phn_nmbr_tx": "9666476298",
      "nm_tx": "John Doe",
      "eml_tx": "john@example.com"
    }
  }
}
```

---

## Wallet Management

### 3. Get Wallet Balance
**GET** `/wallet/balance`

Get user's wallet balance.

**Headers**: `x-access-token: <JWT_TOKEN>`

**Response** (200):
```json
{
  "status": 200,
  "message": "Success",
  "data": {
    "wallet_id": 1,
    "balance": 2500.00,
    "last_updated": "2024-01-15T14:30:00Z"
  }
}
```

### 4. Add Money to Wallet
**POST** `/wallet/add-money`

Add money to user's wallet.

**Headers**: `x-access-token: <JWT_TOKEN>`

**Request Body**:
```json
{
  "amount": 1000,
  "payment_method": "upi",
  "payment_details": {
    "upi_id": "user@upi",
    "transaction_id": "TXN123456"
  }
}
```

**Response** (200):
```json
{
  "status": 200,
  "message": "Money added successfully",
  "data": {
    "transaction_id": 789,
    "amount": 1000,
    "new_balance": 3500.00
  }
}
```

### 5. Get Transaction History
**GET** `/wallet/transactions`

Get user's wallet transaction history.

**Headers**: `x-access-token: <JWT_TOKEN>`

**Query Params**: 
- `limit` (optional, default: 50)
- `offset` (optional, default: 0)

**Response** (200):
```json
{
  "status": 200,
  "message": "Success",
  "data": {
    "transactions": [
      {
        "trxn_id": 1,
        "type": "credit",
        "category": "topup",
        "amount": 1000,
        "balance_before": 2500,
        "balance_after": 3500,
        "description": "Wallet Top-up via UPI",
        "payment_method": "upi",
        "status": "completed",
        "created_at": "2024-01-15T10:15:00Z"
      }
    ],
    "total": 25,
    "limit": 50,
    "offset": 0
  }
}
```

### 6. Transfer Money
**POST** `/wallet/transfer`

Transfer money to another user.

**Headers**: `x-access-token: <JWT_TOKEN>`

**Request Body**:
```json
{
  "to_phone": "9876543210",
  "amount": 500,
  "note": "Payment for charging"
}
```

**Response** (200):
```json
{
  "status": 200,
  "message": "Transfer successful",
  "data": {
    "transaction_id": 790,
    "amount": 500,
    "new_balance": 3000.00
  }
}
```

---

## Charging Stations

### 7. Get Nearby Stations
**GET** `/stations/nearby`

Get charging stations near user's location.

**Headers**: `x-access-token: <JWT_TOKEN>`

**Query Params**:
- `latitude` (required)
- `longitude` (required)
- `radius` (optional, default: 50 km)

**Response** (200):
```json
{
  "status": 200,
  "message": "Success",
  "data": {
    "stations": [
      {
        "station_id": 1,
        "name": "DJT HAIKA PowerHub Mall Road",
        "code": "DJT001",
        "address": "Mall Road, Sector 18",
        "city": "Gurugram",
        "latitude": 28.4595,
        "longitude": 77.0266,
        "distance": 0.5,
        "price_per_kwh": 10.00,
        "total_chargers": 4,
        "available_chargers": 3,
        "rating": 4.5,
        "is_fast_charging": true,
        "power": "150kW",
        "connector_types": ["CCS2", "CHAdeMO"]
      }
    ]
  }
}
```

### 8. Get Station Details
**GET** `/stations/:stationId`

Get detailed information about a specific station.

**Headers**: `x-access-token: <JWT_TOKEN>`

**Response** (200):
```json
{
  "status": 200,
  "message": "Success",
  "data": {
    "station": {
      "station_id": 1,
      "name": "DJT HAIKA PowerHub Mall Road",
      "code": "DJT001",
      "address": "Mall Road, Sector 18",
      "city": "Gurugram",
      "price_per_kwh": 10.00,
      "total_chargers": 4,
      "available_chargers": 3,
      "rating": 4.5,
      "operating_hours": {"open": "00:00", "close": "23:59"},
      "amenities": ["parking", "restroom", "cafe"],
      "connectors": [
        {
          "connector_id": 1,
          "type": "CCS2",
          "power": "150kW",
          "is_available": true
        }
      ]
    }
  }
}
```

### 9. Search Stations
**GET** `/stations/search`

Search charging stations by name or location.

**Headers**: `x-access-token: <JWT_TOKEN>`

**Query Params**:
- `q` (required): Search query

**Response** (200):
```json
{
  "status": 200,
  "message": "Success",
  "data": {
    "stations": [...]
  }
}
```

### 10. Get Favorite Stations
**GET** `/stations/favorites`

Get user's favorite charging stations.

**Headers**: `x-access-token: <JWT_TOKEN>`

**Response** (200):
```json
{
  "status": 200,
  "message": "Success",
  "data": {
    "favorites": [
      {
        "station_id": 1,
        "name": "DJT HAIKA PowerHub Mall Road",
        "address": "Mall Road, Sector 18",
        "favorited_at": "2024-01-10T12:00:00Z"
      }
    ]
  }
}
```

### 11. Add Favorite Station
**POST** `/stations/favorites`

Add station to favorites.

**Headers**: `x-access-token: <JWT_TOKEN>`

**Request Body**:
```json
{
  "station_id": 1
}
```

**Response** (200):
```json
{
  "status": 200,
  "message": "Station added to favorites",
  "data": {}
}
```

### 12. Remove Favorite Station
**DELETE** `/stations/favorites/:stationId`

Remove station from favorites.

**Headers**: `x-access-token: <JWT_TOKEN>`

**Response** (200):
```json
{
  "status": 200,
  "message": "Station removed from favorites",
  "data": {}
}
```

---

## Charging Sessions

### 13. Start Charging Session
**POST** `/sessions/start`

Start a new charging session.

**Headers**: `x-access-token: <JWT_TOKEN>`

**Request Body**:
```json
{
  "station_id": 1,
  "connector_id": 1,
  "qr_code": "DJT001-CH01"
}
```

**Response** (200):
```json
{
  "status": 200,
  "message": "Charging session started",
  "data": {
    "session_id": 123,
    "session_code": "SES-20240115-123",
    "station_name": "DJT HAIKA PowerHub Mall Road",
    "connector_type": "CCS2",
    "price_per_kwh": 10.00,
    "status": "active",
    "start_time": "2024-01-15T14:30:00Z"
  }
}
```

### 14. Stop Charging Session
**POST** `/sessions/stop`

Stop an active charging session.

**Headers**: `x-access-token: <JWT_TOKEN>`

**Request Body**:
```json
{
  "session_id": 123
}
```

**Response** (200):
```json
{
  "status": 200,
  "message": "Charging session stopped",
  "data": {
    "session_id": 123,
    "duration_minutes": 45,
    "energy_consumed": 28.5,
    "total_cost": 285.00,
    "status": "completed",
    "end_time": "2024-01-15T15:15:00Z"
  }
}
```

### 15. Get Active Session
**GET** `/sessions/active`

Get user's current active charging session.

**Headers**: `x-access-token: <JWT_TOKEN>`

**Response** (200):
```json
{
  "status": 200,
  "message": "Success",
  "data": {
    "session": {
      "session_id": 123,
      "station_name": "DJT HAIKA PowerHub Mall Road",
      "connector_type": "CCS2",
      "start_time": "2024-01-15T14:30:00Z",
      "duration_minutes": 25,
      "energy_consumed": 15.8,
      "current_cost": 158.00,
      "progress": 55,
      "status": "active"
    }
  }
}
```

### 16. Get Session History
**GET** `/sessions/history`

Get user's charging session history.

**Headers**: `x-access-token: <JWT_TOKEN>`

**Query Params**:
- `limit` (optional, default: 50)
- `offset` (optional, default: 0)
- `status` (optional): Filter by status

**Response** (200):
```json
{
  "status": 200,
  "message": "Success",
  "data": {
    "sessions": [
      {
        "session_id": 122,
        "station_name": "DJT HAIKA PowerHub Mall Road",
        "date": "2024-01-14",
        "start_time": "14:30",
        "duration_minutes": 45,
        "energy_consumed": 28.5,
        "cost": 285.00,
        "status": "completed"
      }
    ],
    "total": 48,
    "limit": 50,
    "offset": 0
  }
}
```

### 17. Get Session Details
**GET** `/sessions/:sessionId`

Get detailed information about a specific session.

**Headers**: `x-access-token: <JWT_TOKEN>`

**Response** (200):
```json
{
  "status": 200,
  "message": "Success",
  "data": {
    "session": {
      "session_id": 122,
      "session_code": "SES-20240114-122",
      "station": {
        "name": "DJT HAIKA PowerHub Mall Road",
        "address": "Mall Road, Sector 18"
      },
      "connector_type": "CCS2",
      "start_time": "2024-01-14T14:30:00Z",
      "end_time": "2024-01-14T15:15:00Z",
      "duration_minutes": 45,
      "energy_consumed": 28.5,
      "price_per_kwh": 10.00,
      "total_cost": 285.00,
      "status": "completed",
      "payment_status": "paid"
    }
  }
}
```

---

## Station Bookings

### 18. Create Booking
**POST** `/bookings/create`

Book a charging slot at a station.

**Headers**: `x-access-token: <JWT_TOKEN>`

**Request Body**:
```json
{
  "station_id": 1,
  "connector_id": 1,
  "booking_date": "2024-01-20",
  "booking_time": "14:00",
  "duration_minutes": 60
}
```

**Response** (200):
```json
{
  "status": 200,
  "message": "Booking created successfully",
  "data": {
    "booking_id": 45,
    "booking_code": "BKG-20240115-45",
    "station_name": "DJT HAIKA PowerHub Mall Road",
    "booking_date": "2024-01-20",
    "booking_time": "14:00",
    "duration_minutes": 60,
    "status": "confirmed"
  }
}
```

### 19. Get User Bookings
**GET** `/bookings/list`

Get user's bookings.

**Headers**: `x-access-token: <JWT_TOKEN>`

**Query Params**:
- `status` (optional): confirmed, cancelled, completed, expired

**Response** (200):
```json
{
  "status": 200,
  "message": "Success",
  "data": {
    "bookings": [
      {
        "booking_id": 45,
        "booking_code": "BKG-20240115-45",
        "station_name": "DJT HAIKA PowerHub Mall Road",
        "address": "Mall Road, Sector 18",
        "booking_date": "2024-01-20",
        "booking_time": "14:00",
        "duration_minutes": 60,
        "status": "confirmed",
        "created_at": "2024-01-15T12:00:00Z"
      }
    ]
  }
}
```

### 20. Get Upcoming Bookings
**GET** `/bookings/upcoming`

Get user's upcoming bookings.

**Headers**: `x-access-token: <JWT_TOKEN>`

**Response** (200):
```json
{
  "status": 200,
  "message": "Success",
  "data": {
    "bookings": [...]
  }
}
```

### 21. Cancel Booking
**POST** `/bookings/cancel`

Cancel a booking.

**Headers**: `x-access-token: <JWT_TOKEN>`

**Request Body**:
```json
{
  "booking_id": 45,
  "reason": "Plans changed"
}
```

**Response** (200):
```json
{
  "status": 200,
  "message": "Booking cancelled successfully",
  "data": {}
}
```

---

## User Profile

### 22. Get User Profile
**GET** `/profile`

Get user profile information.

**Headers**: `x-access-token: <JWT_TOKEN>`

**Response** (200):
```json
{
  "status": 200,
  "message": "Success",
  "data": {
    "user": {
      "usr_id": 456,
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "9666476298",
      "profile_image": null,
      "created_at": "2024-01-01T00:00:00Z"
    }
  }
}
```

### 23. Update User Profile
**PUT** `/profile`

Update user profile information.

**Headers**: `x-access-token: <JWT_TOKEN>`

**Request Body**:
```json
{
  "name": "John Doe Updated",
  "email": "john.updated@example.com"
}
```

**Response** (200):
```json
{
  "status": 200,
  "message": "Profile updated successfully",
  "data": {
    "user": {...}
  }
}
```

---

## User Vehicles

### 24. Get User Vehicles
**GET** `/vehicles/list`

Get user's registered vehicles.

**Headers**: `x-access-token: <JWT_TOKEN>`

**Response** (200):
```json
{
  "status": 200,
  "message": "Success",
  "data": {
    "vehicles": [
      {
        "vehicle_id": 1,
        "name": "My Tesla",
        "make": "Tesla",
        "model": "Model 3",
        "year": 2023,
        "registration_number": "DL01AB1234",
        "battery_capacity": 75.0,
        "connector_type": "CCS2",
        "is_default": true
      }
    ]
  }
}
```

### 25. Add Vehicle
**POST** `/vehicles/add`

Add a new vehicle.

**Headers**: `x-access-token: <JWT_TOKEN>`

**Request Body**:
```json
{
  "name": "My Tesla",
  "make": "Tesla",
  "model": "Model 3",
  "year": 2023,
  "registration_number": "DL01AB1234",
  "battery_capacity": 75.0,
  "connector_type": "CCS2",
  "is_default": true
}
```

**Response** (200):
```json
{
  "status": 200,
  "message": "Vehicle added successfully",
  "data": {
    "vehicle": {...}
  }
}
```

### 26. Update Vehicle
**PUT** `/vehicles/:vehicleId`

Update vehicle information.

**Headers**: `x-access-token: <JWT_TOKEN>`

**Request Body**:
```json
{
  "name": "My Tesla Updated"
}
```

**Response** (200):
```json
{
  "status": 200,
  "message": "Vehicle updated successfully",
  "data": {}
}
```

### 27. Delete Vehicle
**DELETE** `/vehicles/:vehicleId`

Delete a vehicle.

**Headers**: `x-access-token: <JWT_TOKEN>`

**Response** (200):
```json
{
  "status": 200,
  "message": "Vehicle deleted successfully",
  "data": {}
}
```

---

## Dashboard & Analytics

### 28. Get Dashboard Stats
**GET** `/dashboard/stats`

Get user's dashboard statistics.

**Headers**: `x-access-token: <JWT_TOKEN>`

**Response** (200):
```json
{
  "status": 200,
  "message": "Success",
  "data": {
    "stats": {
      "total_sessions": 48,
      "total_energy_kwh": 1245.5,
      "total_spent": 12450.00,
      "co2_saved_kg": 285.0,
      "avg_session_duration": 38,
      "avg_session_cost": 285.0
    }
  }
}
```

### 29. Get Monthly Analytics
**GET** `/dashboard/analytics/monthly`

Get monthly charging analytics.

**Headers**: `x-access-token: <JWT_TOKEN>`

**Query Params**:
- `months` (optional, default: 6)

**Response** (200):
```json
{
  "status": 200,
  "message": "Success",
  "data": {
    "monthly_data": [
      {
        "month": "Jan",
        "sessions": 12,
        "energy": 180,
        "cost": 1800
      }
    ]
  }
}
```

### 30. Get Weekly Activity
**GET** `/dashboard/analytics/weekly`

Get weekly charging activity.

**Headers**: `x-access-token: <JWT_TOKEN>`

**Response** (200):
```json
{
  "status": 200,
  "message": "Success",
  "data": {
    "weekly_activity": [
      {
        "day": "Monday",
        "sessions": 2
      }
    ]
  }
}
```

### 31. Get Favorite Stations Analytics
**GET** `/dashboard/analytics/favorite-stations`

Get most used stations analytics.

**Headers**: `x-access-token: <JWT_TOKEN>`

**Response** (200):
```json
{
  "status": 200,
  "message": "Success",
  "data": {
    "favorite_stations": [
      {
        "name": "PowerHub Mall Road",
        "sessions": 15,
        "percentage": 31
      }
    ]
  }
}
```

---

## Error Responses

All endpoints return errors in the following format:

```json
{
  "status": 400,
  "message": "Error message",
  "data": null,
  "errors": ["Detailed error 1", "Detailed error 2"]
}
```

### Common Error Codes:
- `400` - Bad Request
- `401` - Unauthorized (Invalid or missing token)
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

---

## Authentication

All protected endpoints require JWT token in header:
```
x-access-token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Token is returned from `/auth/app/verify/otp` endpoint and should be stored in localStorage.

---

## Rate Limiting

- Authentication endpoints: 10 requests per minute per IP
- Other endpoints: 100 requests per minute per user

---

## Database Tables Summary

1. **usr_lst_t** - User information
2. **otp_lst_t** - OTP authentication
3. **wllt_lst_t** - User wallet balances
4. **trxn_lst_t** - Transaction history
5. **sttn_lst_t** - Charging station details
6. **cnntr_lst_t** - Station connector types
7. **fvrt_lst_t** - User favorites
8. **sssn_lst_t** - Charging session records
9. **sssn_log_lst_t** - Real-time session logs
10. **bkng_lst_t** - Station bookings
11. **vhcl_lst_t** - User vehicle information
12. **stt_lst_t** - User aggregated statistics
13. **ntfctn_lst_t** - User notifications
14. **offr_lst_t** - Promotional offers
15. **usg_lst_t** - Offer usage tracking

---

## Testing

Use the provided test phone numbers for development:
- `9666476298`
- `8500382863`

All test OTPs are logged to console in development mode.
