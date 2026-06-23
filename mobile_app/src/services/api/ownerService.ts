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
  type: string;
  name: string;
  power: string | null;
  is_available: boolean;
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
    available: { value: number; trend_pct: number };
  };
  today: {
    revenue: number;
    consumption: number;
    transactions: number;
    revenue_trend_pct: number;
    consumption_trend_pct: number;
  };
  month: {
    revenue: number;
    consumption: number;
    avg_revenue_per_kwh: number;
    transactions_today: number;
  };
  charts: { hourly: { hour: string; revenue: number; consumption: number }[] };
  station_status: { active: number; offline: number; faulted: number; maintenance: number; total: number };
  recent_transactions: {
    code: string;
    station: string;
    connector: string | null;
    energy_kwh: number;
    duration_min: number | null;
    cost: number;
    status: string;
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
  cost: number;
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

  getMyStations: async (): Promise<OwnerStation[]> => {
    const res = await apiClient.get<{ data: { stations: OwnerStation[] } }>('/owner/stations', AUTH);
    return res.data?.stations || [];
  },

  getTransactions: async (limit = 50): Promise<OwnerTransaction[]> => {
    const res = await apiClient.get<{ data: { transactions: OwnerTransaction[] } }>(`/owner/transactions?limit=${limit}`, AUTH);
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
};
