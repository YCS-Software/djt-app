/**
 * Owner API Service
 * EV station owner: dashboard, stations, machines (chargers), connectors.
 */

import { apiClient } from './apiClient';

export interface OwnerDashboard {
  total_stations: number;
  total_machines: number;
  total_connectors: number;
  available_machines: number;
}

export interface OwnerConnector {
  connector_id: number;
  station_id: number;
  machine_id: number;
  code?: string | null;
  type: string;
  name: string;
  power: string | null;
  is_available: boolean;
}

export interface ConnectorQr {
  token: string;
  connector: {
    connector_id: number;
    code: string | null;
    type: string;
    name: string;
    power: string | null;
    is_available: boolean;
    machine_id: number;
    machine_name: string;
    machine_type: string;
    station_name: string;
    ocpp_id: string | null;
    ws_url: string | null;
    price_per_kwh: number;
    configured: boolean;
  };
}

export interface PowerOption {
  power_id: number;
  code: string;          // e.g. DC-60kW
  label: string;         // e.g. DC 60 kW
  machine_type: string;  // AC | DC | DCS
  kw: number;
  default_connector_type: string;
}

export interface OwnerAnalytics {
  cards: {
    stations: { value: number; trend_pct: number };
    machines: { value: number; trend_pct: number };
    connectors: { value: number; trend_pct: number };
    // `available` reports the share of machines currently free, not a
    // day-over-day change, so it carries ratio_pct rather than trend_pct.
    available: { value: number; ratio_pct: number };
  };
  today: {
    net: number;
    billed: number;            // everything the driver paid, GST-inclusive
    direct_collected: number;
    total_earned: number;      // net + direct_collected
    consumption: number;
    transactions: number;
    net_trend_pct: number;
    consumption_trend_pct: number;
  };
  month: {
    net: number;
    billed: number;
    commission: number;        // the DJT share
    direct_collected: number;
    total_earned: number;
    consumption: number;
    avg_net_per_kwh: number;
    transactions: number;
    net_trend_pct: number;
  };
  balance: { available: number; in_escrow: number; active_sessions: number };
  commission: {
    owner_pct: number | null;
    platform_pct: number | null;
    tax_pct: number;
    scope: string | null;
  };
  charts: { hourly: { hour: string; revenue: number; gross: number; consumption: number }[] };
  station_status: { active: number; offline: number; faulted: number; maintenance: number; total: number };
  recent_transactions: {
    code: string;
    station: string;
    connector: string | null;
    energy_kwh: number;
    duration_min: number | null;
    net: number;
    gross: number;
    status: string;
    payment_status: string | null;
    started_at: string | null;
  }[];
}

/**
 * A period's money. The identity shown on screen is:
 *     billed − commission = total_earned
 * `settled` is the ledger-only slice and excludes machine-collected energy, so
 * it is deliberately never labelled "gross" in the UI.
 */
export interface EarningsPeriod {
  net: number;              // credited to the owner's earnings account
  commission: number;       // the DJT share
  settled: number;          // net + commission (what passed through the ledger)
  billed: number;           // net + commission + direct_collected (what the driver paid)
  direct_collected: number; // energy past the prepaid hold, collected at the machine
  total_earned: number;     // net + direct_collected — what the owner actually keeps
  net_trend_pct?: number;
}

export interface OwnerEarnings {
  today: EarningsPeriod;
  month: EarningsPeriod;
  lifetime: EarningsPeriod;
  balance: {
    available: number;
    currency: string;
    in_escrow: number;
    active_sessions: number;
  };
  commission: {
    owner_pct: number | null;
    platform_pct: number | null;
    tax_pct: number;
    scope: string | null;
    station_overrides: {
      station_id: number;
      station: string;
      owner_pct: number;
      platform_pct: number;
    }[];
  };
  refunds: { month: number; lifetime: number };
  direct_collected: { today: number; month: number; lifetime: number; session_count: number };
}

export interface OwnerSettlement {
  settlement_id: number;
  period_from: string | null;
  period_to: string | null;
  gross: number;
  commission: number;
  tax: number;
  net: number;
  status: string;         // pending | settled | failed
  utr: string | null;
  settled_at: string | null;
  created_at: string;
}

export interface OwnerSettlements {
  settlements: OwnerSettlement[];
  pending_net: number;
  last_settled: OwnerSettlement | null;
}

export interface StationBreakdownRow {
  station_id: number;
  name: string;
  city: string | null;
  operator: string | null;
  approval_status: string;
  net: number;
  commission: number;
  gross: number;
  session_gross: number;
  consumption: number;
  transactions: number;
  failed_transactions: number;
  failure_rate_pct: number;
  charge_minutes: number;
  utilisation_pct: number;
  // null for a lifetime window — there is no earlier period to compare against.
  net_trend_pct: number | null;
  share_pct: number;
  machines: number;
  faulted_machines: number;
  offline_machines: number;
  maintenance_machines: number;
  last_heartbeat_ts: string | null;
  mins_since_heartbeat: number | null;
}

export interface StationBreakdown {
  range: { from: string; to: string; days: number; lifetime: boolean };
  totals: {
    net: number;
    commission: number;
    consumption: number;
    transactions: number;
    stations: number;
    utilisation_pct: number;
  };
  stations: StationBreakdownRow[];
  attention: {
    station_id: number;
    station: string;
    kind: 'faulted' | 'no_heartbeat' | 'never_seen';
    message: string;
    mins_since_heartbeat?: number;
  }[];
}

export interface MachineQr {
  token: string;
  machine: {
    machine_id: number;
    name: string;
    station_name: string;
    ocpp_id: string | null;
    ws_url: string | null;
    machine_type: string;
    power_label: string | null;
    price_per_kwh: number;
    configured: boolean;
  };
}

export interface MachineProfile {
  machine: {
    machine_id: number;
    station_id: number;
    station_name: string;
    name: string;
    serial_no: string | null;
    ocpp_id: string | null;
    ws_url: string | null;
    machine_type: string;
    power_code: string | null;
    power_label: string | null;
    kw: number | null;
    max_power: string | null;
    total_connectors: number;
    status: string;
    last_heartbeat: string | null;
    created_at: string;
  };
  connectors: OwnerConnector[];
  analytics: {
    today: { revenue: number; consumption: number; sessions: number; revenue_trend_pct: number; consumption_trend_pct: number };
    month: { revenue: number; consumption: number; sessions: number; avg_revenue_per_kwh: number };
    lifetime: { revenue: number; consumption: number; sessions: number; avg_duration_min: number; last_session: string | null };
  };
}

export interface StationAnalytics {
  today: {
    revenue: number;
    consumption: number;
    sessions: number;
    revenue_trend_pct: number;
    consumption_trend_pct: number;
  };
  month: {
    revenue: number;
    consumption: number;
    sessions: number;
    avg_revenue_per_kwh: number;
  };
  lifetime: {
    revenue: number;
    consumption: number;
    sessions: number;
    avg_duration_min: number;
  };
  inventory: {
    machines: number;
    available_machines: number;
    connectors: number;
  };
}

export interface OwnerTransaction {
  code: string;
  station: string;
  connector: string | null;
  customer: string | null;
  energy_kwh: number;
  duration_min: number | null;
  cost: number;              // gross — what the driver was billed
  settled: number;           // net + commission — what passed through the ledger
  net: number;               // the owner's share, credited by the ledger
  commission: number;        // the platform's share
  owner_pct: number | null;  // realised split, derived from posted amounts
  platform_pct: number | null;
  direct_collected: number;  // over-hold energy collected at the machine
  status: string;
  payment_status: string;
  date: string | null;
}

export interface OcppConnection {
  ocpp_id: string;
  machine_id: number | null;
  station_id: number | null;
  connected_at: string;
  last_seen: string;
  authorized_user: number | null;
}

/** Ack returned by a Charger Controls command (the charger's OCPP response). */
export interface ChargerCommandResult {
  result?: { status?: string; fileName?: string } | null;
}

export interface ChargerConfigKey { key: string; value?: string | null; readonly?: boolean; }
export interface ChargerConfigResult {
  result?: { configurationKey?: ChargerConfigKey[]; unknownKey?: string[] } | null;
}
export interface DiagnosticsParams { location: string; retries?: number; retry_interval?: number; start_time?: string; stop_time?: string; }
export interface FirmwareParams { location: string; retrieve_date?: string; retries?: number; retry_interval?: number; }

export interface OwnerMachine {
  machine_id: number;
  station_id: number;
  name: string;
  serial_no: string | null;
  ocpp_id: string | null;
  ws_url: string | null;
  machine_type: string;
  power_id?: number | null;
  power_code?: string | null;
  power_label?: string | null;
  kw?: number | null;
  max_power: string | null;
  total_connectors: number;
  status: string;
  last_heartbeat?: string | null;
  connectors?: OwnerConnector[];
}

export interface AddMachineResult {
  machine_id: number;
  ocpp_id: string;
  ws_url: string;
  machine_type: string;
  max_power: string;
  power_label: string;
  connector_type: string;
  connectors_created: number;
}

export interface OwnerStation {
  station_id: number;
  owner_id: number;
  approval_status: string;
  name: string;
  code: string;
  address: string;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  price_per_kwh: number;
  total_chargers: number;
  available_chargers: number;
  is_fast_charging: boolean;
  power: string | null;
  operator_name: string | null;
  contact_number: string | null;
  rating: number;
  machine_count?: number;
  connector_count?: number;
  machines?: OwnerMachine[];
  created_at?: string;
}

export interface CreateStationRequest {
  name: string;
  address: string;
  city?: string;
  state?: string;
  postal_code?: string;
  latitude: number;
  longitude: number;
  price_per_kwh?: number;
  is_fast_charging?: boolean;
  power?: string;
  operator_name?: string;
  contact_number?: string;
}

export interface CreateMachineRequest {
  name: string;
  serial_no?: string;
  mchn_pwr_id: number;       // selected power tier (drives machine type + power)
  connector_count?: number;  // default 2
}

export interface CreateConnectorRequest {
  connector_type: string; // CCS2 | CHAdeMO | Type2
  name?: string;
  power?: string;
}

const AUTH = { requiresAuth: true };

export const ownerService = {
  getDashboard: async (): Promise<OwnerDashboard> => {
    const res = await apiClient.get<{ data: OwnerDashboard }>('/owner/dashboard', AUTH);
    return res.data;
  },

  getAnalytics: async (): Promise<OwnerAnalytics> => {
    const res = await apiClient.get<{ data: OwnerAnalytics }>('/owner/analytics', AUTH);
    return res.data;
  },

  // Net earnings from the ledger — the money the owner actually receives.
  getEarnings: async (): Promise<OwnerEarnings> => {
    const res = await apiClient.get<{ data: OwnerEarnings }>('/owner/earnings', AUTH);
    return res.data;
  },

  getSettlements: async (limit = 12): Promise<OwnerSettlements> => {
    const res = await apiClient.get<{ data: OwnerSettlements }>(`/owner/settlements?limit=${limit}`, AUTH);
    return res.data;
  },

  // Station-wise analytics. Omit the argument for month-to-date; pass
  // 'lifetime' to widen the window back to the owner's first activity.
  getStationBreakdown: async (
    range?: { from: string; to: string } | 'lifetime',
  ): Promise<StationBreakdown> => {
    const qs = range === 'lifetime'
      ? '?range=lifetime'
      : range ? `?from=${range.from}&to=${range.to}` : '';
    const res = await apiClient.get<{ data: StationBreakdown }>(`/owner/analytics/stations${qs}`, AUTH);
    return res.data;
  },

  getMyStations: async (): Promise<OwnerStation[]> => {
    const res = await apiClient.get<{ data: { stations: OwnerStation[] } }>('/owner/stations', AUTH);
    return res.data?.stations || [];
  },

  // Omit `range` for all time; pass an inclusive from/to window to filter by date.
  getTransactions: async (
    limit = 50,
    range?: { from: string; to: string },
  ): Promise<OwnerTransaction[]> => {
    const qs = range ? `&from=${range.from}&to=${range.to}` : '';
    const res = await apiClient.get<{ data: { transactions: OwnerTransaction[] } }>(
      `/owner/transactions?limit=${limit}${qs}`, AUTH);
    return res.data?.transactions || [];
  },

  getStationDetail: async (stationId: number): Promise<OwnerStation> => {
    const res = await apiClient.get<{ data: { station: OwnerStation } }>(`/owner/stations/${stationId}`, AUTH);
    return res.data.station;
  },

  getStationAnalytics: async (stationId: number): Promise<StationAnalytics> => {
    const res = await apiClient.get<{ data: StationAnalytics }>(`/owner/stations/${stationId}/analytics`, AUTH);
    return res.data;
  },

  createStation: async (data: CreateStationRequest): Promise<OwnerStation> => {
    const res = await apiClient.post<{ data: { station: OwnerStation } }>('/owner/stations', data, AUTH);
    return res.data.station;
  },

  updateStation: async (stationId: number, data: Partial<CreateStationRequest>): Promise<OwnerStation> => {
    const res = await apiClient.put<{ data: { station: OwnerStation } }>(`/owner/stations/${stationId}`, data, AUTH);
    return res.data.station;
  },

  getStationMachines: async (stationId: number): Promise<OwnerMachine[]> => {
    const res = await apiClient.get<{ data: { machines: OwnerMachine[] } }>(`/owner/stations/${stationId}/machines`, AUTH);
    return res.data?.machines || [];
  },

  getPowerOptions: async (): Promise<PowerOption[]> => {
    const res = await apiClient.get<{ data: { power_options: PowerOption[] } }>('/owner/power-options', AUTH);
    return res.data?.power_options || [];
  },

  // Live-connected charge points (in-memory OCPP registry) — used for online/offline status
  getOcppConnections: async (): Promise<OcppConnection[]> => {
    const res = await apiClient.get<{ data: { connections: OcppConnection[] } }>('/ocpp/connections', AUTH);
    return res.data?.connections || [];
  },

  getMachineProfile: async (machineId: number): Promise<MachineProfile> => {
    const res = await apiClient.get<{ data: MachineProfile }>(`/owner/machines/${machineId}`, AUTH);
    return res.data;
  },

  getMachineQr: async (machineId: number): Promise<MachineQr> => {
    const res = await apiClient.get<{ data: MachineQr }>(`/owner/machines/${machineId}/qr`, AUTH);
    return res.data;
  },

  getConnectorQr: async (connectorId: number): Promise<ConnectorQr> => {
    const res = await apiClient.get<{ data: ConnectorQr }>(`/owner/connectors/${connectorId}/qr`, AUTH);
    return res.data;
  },

  addMachine: async (stationId: number, data: CreateMachineRequest): Promise<AddMachineResult> => {
    const res = await apiClient.post<{ data: AddMachineResult }>(`/owner/stations/${stationId}/machines`, data, AUTH);
    return res.data;
  },

  updateMachine: async (machineId: number, data: Partial<CreateMachineRequest>): Promise<void> => {
    await apiClient.put(`/owner/machines/${machineId}`, data, AUTH);
  },

  addConnector: async (machineId: number, data: CreateConnectorRequest): Promise<number> => {
    const res = await apiClient.post<{ data: { connector_id: number } }>(`/owner/machines/${machineId}/connectors`, data, AUTH);
    return res.data.connector_id;
  },

  // ---- Charger Controls (owner remote OCPP operations) ----
  // Each returns the charger's ack, e.g. { result: { status: 'Accepted' | 'Rejected' | 'Unlocked' | ... } }.
  chargerReset: async (ocppId: string, type: 'Soft' | 'Hard' = 'Soft'): Promise<ChargerCommandResult> => {
    const res = await apiClient.post<{ data: ChargerCommandResult }>('/ocpp/reset', { ocpp_id: ocppId, type }, AUTH);
    return res.data;
  },
  chargerClearCache: async (ocppId: string): Promise<ChargerCommandResult> => {
    const res = await apiClient.post<{ data: ChargerCommandResult }>('/ocpp/clear-cache', { ocpp_id: ocppId }, AUTH);
    return res.data;
  },
  chargerUnlockConnector: async (ocppId: string, connectorId: number): Promise<ChargerCommandResult> => {
    const res = await apiClient.post<{ data: ChargerCommandResult }>('/ocpp/unlock-connector', { ocpp_id: ocppId, connector_id: connectorId }, AUTH);
    return res.data;
  },
  chargerChangeAvailability: async (ocppId: string, type: 'Operative' | 'Inoperative', connectorId = 0): Promise<ChargerCommandResult> => {
    const res = await apiClient.post<{ data: ChargerCommandResult }>('/ocpp/change-availability', { ocpp_id: ocppId, type, connector_id: connectorId }, AUTH);
    return res.data;
  },
  chargerTriggerMessage: async (ocppId: string, requestedMessage = 'StatusNotification', connectorId?: number): Promise<ChargerCommandResult> => {
    const res = await apiClient.post<{ data: ChargerCommandResult }>('/ocpp/trigger-message', { ocpp_id: ocppId, requested_message: requestedMessage, connector_id: connectorId }, AUTH);
    return res.data;
  },
  chargerGetConfiguration: async (ocppId: string, keys?: string[]): Promise<ChargerConfigResult> => {
    const res = await apiClient.post<{ data: ChargerConfigResult }>('/ocpp/get-configuration', { ocpp_id: ocppId, keys }, AUTH);
    return res.data;
  },
  chargerGetDiagnostics: async (ocppId: string, params: DiagnosticsParams): Promise<ChargerCommandResult> => {
    const res = await apiClient.post<{ data: ChargerCommandResult }>('/ocpp/get-diagnostics', { ocpp_id: ocppId, ...params }, AUTH);
    return res.data;
  },
  chargerUpdateFirmware: async (ocppId: string, params: FirmwareParams): Promise<ChargerCommandResult> => {
    const res = await apiClient.post<{ data: ChargerCommandResult }>('/ocpp/update-firmware', { ocpp_id: ocppId, ...params }, AUTH);
    return res.data;
  },
};
