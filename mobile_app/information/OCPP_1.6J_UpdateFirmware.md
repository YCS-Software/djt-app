# OCPP 1.6J - UpdateFirmware

## REST API

### Route

```http
POST /api/v1/chargers/{chargerId}/firmware
```

## REST Request

```json
{
  "location":"https://your-server.com/firmware/charger-v1.2.0.bin",
  "retrieveDate":"2026-07-18T18:00:00Z",
  "retries":3,
  "retryInterval":60
}
```

## REST Success Response

```json
{
  "success":true,
  "message":"Firmware update request sent."
}
```

## OCPP Request

```json
[
  2,
  "uuid",
  "UpdateFirmware",
  {
    "location":"https://your-server.com/firmware/charger-v1.2.0.bin",
    "retrieveDate":"2026-07-18T18:00:00Z",
    "retries":3,
    "retryInterval":60
  }
]
```

## OCPP Response

```json
[
  3,
  "uuid",
  {}
]
```

## FirmwareStatusNotification

### Downloading

```json
[
2,"msg1","FirmwareStatusNotification",{"status":"Downloading"}
]
```

### Downloaded

```json
[
2,"msg2","FirmwareStatusNotification",{"status":"Downloaded"}
]
```

### Installing

```json
[
2,"msg3","FirmwareStatusNotification",{"status":"Installing"}
]
```

### Installed

```json
[
2,"msg4","FirmwareStatusNotification",{"status":"Installed"}
]
```

### DownloadFailed

```json
[
2,"msg5","FirmwareStatusNotification",{"status":"DownloadFailed"}
]
```

### InstallationFailed

```json
[
2,"msg6","FirmwareStatusNotification",{"status":"InstallationFailed"}
]
```

Response for every FirmwareStatusNotification

```json
[
3,"<messageId>",{}
]
```

## Flow

```text
POST /firmware
      ↓
UpdateFirmware.req
      ↓
UpdateFirmware.conf
      ↓
Downloading
      ↓
Downloaded
      ↓
Installing
      ↓
Installed
```
