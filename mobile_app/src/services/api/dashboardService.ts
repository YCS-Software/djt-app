/**
 * Dashboard API Service
 * Provides home page data including wallet, stations, and history
 */

import { apiClient } from './apiClient';

export interface NearbyStation {
  station_id: number;
  name: string;
  address: string;
  distance: string;
  available_chargers: number;
  total_chargers: number;
  price_per_kwh: number;
  rating: number;
  is_fast_charging: boolean;
  power: string;
}

export interface RecentSession {
  session_id: number;
  station_name: string;
  date: string;
  energy_consumed: number;
  cost: number;
  duration_minutes: number;
  status: string;
}

export interface WalletData {
  balance: number;
  last_updated: string;
}

export interface UserStats {
  total_sessions: number;
  total_energy_kwh: number;
  total_spent: number;
  co2_saved_kg: number;
}

export interface HomePageData {
  wallet: WalletData;
  nearby_stations: NearbyStation[];
  recent_sessions: RecentSession[];
  stats: UserStats;
}

export const dashboardService = {
  /**
   * Get home page data (wallet, stations, history, stats)
   */
  getHomeData: async (): Promise<HomePageData> => {
    const response = await apiClient.get<any>('/dashboard/home', {
      requiresAuth: true,
    });
    return response.data;
  },

  /**
   * Get dashboard statistics
   */
  getStats: async (): Promise<UserStats> => {
    const response = await apiClient.get<any>('/dashboard/stats', {
      requiresAuth: true,
    });
    return response.data.stats;
  },
};
