/**
 * User Profile API Service
 */

import { apiClient } from './apiClient';

export interface UserProfile {
  usr_id: number;
  name: string;
  email: string;
  phone: string;
  profile_image?: string;
  created_at: string;
}

export interface UpdateProfileRequest {
  name?: string;
  email?: string;
}

export interface Vehicle {
  vehicle_id: number;
  name: string;
  make: string;
  model: string;
  year: number;
  registration_number: string;
  battery_capacity: number;
  connector_type: string;
  is_default: boolean;
}

export interface AddVehicleRequest {
  name: string;
  make: string;
  model: string;
  year: number;
  registration_number: string;
  battery_capacity: number;
  connector_type: string;
  is_default?: boolean;
}

export const profileService = {
  /**
   * Get user profile
   */
  getProfile: async (): Promise<UserProfile> => {
    const response = await apiClient.get<any>('/profile', {
      requiresAuth: true,
    });
    return response.data.user;
  },

  /**
   * Update user profile
   */
  updateProfile: async (data: UpdateProfileRequest): Promise<UserProfile> => {
    const response = await apiClient.put<any>('/profile', data, {
      requiresAuth: true,
    });
    return response.data.user;
  },

  /**
   * Get user vehicles
   */
  getVehicles: async (): Promise<Vehicle[]> => {
    const response = await apiClient.get<any>('/vehicles/list', {
      requiresAuth: true,
    });
    return response.data.vehicles;
  },

  /**
   * Add a vehicle
   */
  addVehicle: async (data: AddVehicleRequest): Promise<Vehicle> => {
    const response = await apiClient.post<any>('/vehicles/add', data, {
      requiresAuth: true,
    });
    return response.data.vehicle;
  },

  /**
   * Update a vehicle
   */
  updateVehicle: async (
    vehicleId: number,
    data: Partial<AddVehicleRequest>
  ): Promise<void> => {
    await apiClient.put<any>(`/vehicles/${vehicleId}`, data, {
      requiresAuth: true,
    });
  },

  /**
   * Delete a vehicle
   */
  deleteVehicle: async (vehicleId: number): Promise<void> => {
    await apiClient.delete<any>(`/vehicles/${vehicleId}`, {
      requiresAuth: true,
    });
  },
};
