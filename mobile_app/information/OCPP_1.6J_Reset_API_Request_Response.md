# OCPP 1.6J Reset Command

## Route
`POST /api/v1/chargers/{chargerId}/reset`

### Request
```json
{"type":"Soft"}
```

### OCPP Request
```json
[2,"uuid","Reset",{"type":"Soft"}]
```

### OCPP Response
```json
[3,"uuid",{"status":"Accepted"}]
```

Possible status: Accepted, Rejected.

### Backend Response
```json
{"success":true,"status":"Accepted","message":"Reset request accepted by charger."}
```

## Flow
```text
Mobile App -> Backend -> Reset.req -> Charger -> Reset.conf -> Reboot -> BootNotification -> StatusNotification(Available)
```
