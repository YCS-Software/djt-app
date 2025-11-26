/**
 * Dashboard & Analytics API Service
 */

import { apiClient } from './apiClient';

export interface DashboardStats {
  total_sessions: number;
  total_energy_kwh: number;
  total_spent: number;
  co2_saved_kg: number;
  avg_session_duration: number;
  avg_session_cost: number;
}

export interface MonthlyData {
  month: string;
  sessions: number;
  energy: number;
  cost: number;
}

export interface WeeklyActivity {
  day: string;
  sessions: number;
}

export interface StationUsage {
  name: string;
  sessions: number;
  percentage: number;
}

export const dashboardService = {
  /**
   * Get dashboard statistics
   */
  getStats: async (): Promise<DashboardStats> => {
    const response = await apiClient.get<any>('/dashboard/stats', {
      requiresAuth: true,
    });
    return response.data.stats;
  },

  /**
   * Get monthly analytics
   */
  getMonthlyAnalytics: async (months = 6): Promise<MonthlyData[]> => {
    const response = await apiClient.get<any>(
      `/dashboard/analytics/monthly/${months}`,
      { requiresAuth: true }
    );
    return response.data.monthly_data;
  },

  /**
   * Get weekly activity
   */
  getWeeklyActivity: async (): Promise<WeeklyActivity[]> => {
    const response = await apiClient.get<any>('/dashboard/analytics/weekly', {
      requiresAuth: true,
    });
    return response.data.weekly_activity;
  },

  /**
   * Get favorite stations analytics
   */
  getFavoriteStations: async (): Promise<StationUsage[]> => {
    const response = await apiClient.get<any>(
      '/dashboard/analytics/favorite-stations',
      { requiresAuth: true }
    );
    return response.data.favorite_stations;
  },
};
