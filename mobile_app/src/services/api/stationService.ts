/**
 * Charging Station API Service
 */

import { apiClient } from './apiClient';

export interface ChargingStation {
  station_id: number;
  name: string;
  code: string;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  distance?: number;
  price_per_kwh: number;
  total_chargers: number;
  available_chargers: number;
  rating: number;
  is_fast_charging: boolean;
  power: string;
  connector_types?: string[];
  connectors?: Connector[];
}

export interface Connector {
  connector_id: number;
  type: string;
  power: string;
  is_available: boolean;
}

export const stationService = {
  /**
   * Get nearby charging stations
   */
  getNearbyStations: async (
    latitude: number,
    longitude: number,
    radius = 50
  ): Promise<ChargingStation[]> => {
    const response = await apiClient.get<any>(
      `/stations/nearby?latitude=${latitude}&longitude=${longitude}&radius=${radius}`,
      { requiresAuth: true }
    );
    return response.data.stations;
  },

  /**
   * Get station details
   */
  getStationDetails: async (stationId: number): Promise<ChargingStation> => {
    const response = await apiClient.get<any>(`/stations/${stationId}`, {
      requiresAuth: true,
    });
    return response.data.station;
  },

  /**
   * Search stations
   */
  searchStations: async (query: string): Promise<ChargingStation[]> => {
    const response = await apiClient.get<any>(
      `/stations/search?q=${encodeURIComponent(query)}`,
      { requiresAuth: true }
    );
    return response.data.stations;
  },

  /**
   * Get favorite stations
   */
  getFavorites: async (): Promise<ChargingStation[]> => {
    const response = await apiClient.get<any>('/stations/favorites', {
      requiresAuth: true,
    });
    return response.data.favorites;
  },

  /**
   * Add station to favorites
   */
  addFavorite: async (stationId: number): Promise<void> => {
    await apiClient.post<any>(
      '/stations/favorites',
      { station_id: stationId },
      { requiresAuth: true }
    );
  },

  /**
   * Remove station from favorites
   */
  removeFavorite: async (stationId: number): Promise<void> => {
    await apiClient.delete<any>(`/stations/favorites/${stationId}`, {
      requiresAuth: true,
    });
  },

  /**
   * Get all active stations
   */
  getAllStations: async (): Promise<ChargingStation[]> => {
    const response = await apiClient.get<any>('/stations/all', {
      requiresAuth: true,
    });
    return response.data.stations;
  },
};
