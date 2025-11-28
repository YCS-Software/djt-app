/**
 * Charging Session API Service
 */

import { apiClient } from './apiClient';

export interface ChargingSession {
  session_id: number;
  session_code: string;
  station_name: string;
  station_id?: number;
  address?: string;
  connector_type: string;
  start_time: string;
  end_time?: string;
  duration_minutes?: number;
  energy_consumed: number;
  current_cost?: number;
  total_cost?: number;
  price_per_kwh: number;
  progress: number;
  status: string;
  payment_status?: string;
}

export interface StartSessionRequest {
  station_id: number;
  connector_id: number;
  qr_code?: string;
  selected_units?: number;
  total_amount?: number;
}

export interface StopSessionRequest {
  session_id: number;
  charged_units?: number;
  charged_cost?: number;
  is_fully_completed?: boolean;
}

export const sessionService = {
  /**
   * Start a charging session
   */
  startSession: async (data: StartSessionRequest): Promise<ChargingSession> => {
    const response = await apiClient.post<any>('/sessions/start', data, {
      requiresAuth: true,
    });
    return response.data;
  },

  /**
   * Stop a charging session
   */
  stopSession: async (data: StopSessionRequest): Promise<ChargingSession> => {
    const response = await apiClient.post<any>('/sessions/stop', data, {
      requiresAuth: true,
    });
    return response.data;
  },

  /**
   * Get active charging session
   */
  getActiveSession: async (): Promise<ChargingSession | null> => {
    const response = await apiClient.get<any>('/sessions/active', {
      requiresAuth: true,
    });
    return response.data.session;
  },

  /**
   * Get session history
   */
  getSessionHistory: async (
    limit = 50,
    offset = 0,
    status?: string
  ): Promise<ChargingSession[]> => {
    let url = `/sessions/history?limit=${limit}&offset=${offset}`;
    if (status) {
      url += `&status=${status}`;
    }
    const response = await apiClient.get<any>(url, { requiresAuth: true });
    return response.data.sessions;
  },

  /**
   * Get session details
   */
  getSessionDetails: async (sessionId: number): Promise<ChargingSession> => {
    const response = await apiClient.get<any>(`/sessions/${sessionId}`, {
      requiresAuth: true,
    });
    return response.data.session;
  },
};
