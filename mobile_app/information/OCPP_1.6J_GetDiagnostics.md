# OCPP 1.6J - GetDiagnostics

## Route
`POST /api/v1/chargers/{chargerId}/diagnostics`

## REST Request
```json
{"location":"https://your-server.com/diagnostics/","retries":3,"retryInterval":60,"startTime":"2026-07-18T00:00:00Z","stopTime":"2026-07-18T23:59:59Z"}
```

## OCPP Request
```json
[2,"uuid","GetDiagnostics",{"location":"https://your-server.com/diagnostics/","retries":3,"retryInterval":60,"startTime":"2026-07-18T00:00:00Z","stopTime":"2026-07-18T23:59:59Z"}]
```

## OCPP Response
```json
[3,"uuid",{"fileName":"diagnostics_CP001_20260718.log"}]
```

## DiagnosticsStatusNotification Uploading
```json
[2,"msg1","DiagnosticsStatusNotification",{"status":"Uploading"}]
```
Response:
```json
[3,"msg1",{}]
```

## Uploaded
```json
[2,"msg2","DiagnosticsStatusNotification",{"status":"Uploaded"}]
```

## UploadFailed
```json
[2,"msg3","DiagnosticsStatusNotification",{"status":"UploadFailed"}]
```
