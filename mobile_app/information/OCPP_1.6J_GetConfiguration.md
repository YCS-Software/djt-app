# OCPP 1.6J - GetConfiguration

## REST API

### Route

```http
GET /api/v1/chargers/{chargerId}/configuration
```

## REST Success Response

```json
{
  "success": true,
  "chargerId": "DJT-12-CP1-T6I",
  "message": "Configuration request sent."
}
```

## OCPP Request (All Configuration)

```json
[
  2,
  "uuid",
  "GetConfiguration",
  {}
]
```

## OCPP Request (Specific Keys)

```json
[
  2,
  "uuid",
  "GetConfiguration",
  {
    "key": [
      "HeartbeatInterval",
      "MeterValueSampleInterval",
      "AuthorizeRemoteTxRequests"
    ]
  }
]
```

## OCPP Response

```json
[
  3,
  "uuid",
  {
    "configurationKey": [
      {
        "key": "HeartbeatInterval",
        "readonly": false,
        "value": "300"
      },
      {
        "key": "MeterValueSampleInterval",
        "readonly": false,
        "value": "30"
      },
      {
        "key": "AuthorizeRemoteTxRequests",
        "readonly": false,
        "value": "true"
      }
    ],
    "unknownKey": []
  }
]
```

## Response Fields

| Field | Description |
|-------|-------------|
| configurationKey | List of available configuration keys |
| key | Configuration key name |
| value | Current value |
| readonly | Indicates if the key can be modified |
| unknownKey | Keys not supported by the charger |

## Flow

```text
GET /configuration
        ↓
GetConfiguration.req
        ↓
Charge Point
        ↓
GetConfiguration.conf
        ↓
Display Configuration
```

## Common Configuration Keys

- HeartbeatInterval
- MeterValueSampleInterval
- ClockAlignedDataInterval
- AuthorizeRemoteTxRequests
- StopTxnSampledData
- StopTxnAlignedData
- ConnectorPhaseRotation
- WebSocketPingInterval
- ConnectionTimeOut
- ResetRetries
