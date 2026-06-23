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

  getMyStations: async (): Promise<OwnerStation[]> => {
    const res = await apiClient.get<{ data: { stations: OwnerStation[] } }>('/owner/stations', AUTH);
    return res.data?.stations || [];
  },

  getStationDetail: async (stationId: number): Promise<OwnerStation> => {
    const res = await apiClient.get<{ data: { station: OwnerStation } }>(`/owner/stations/${stationId}`, AUTH);
    return res.data.station;
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
