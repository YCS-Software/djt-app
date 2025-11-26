/**
 * Station Booking API Service
 */

import { apiClient } from './apiClient';

export interface Booking {
  booking_id: number;
  booking_code: string;
  station_name: string;
  station_id: number;
  address?: string;
  booking_date: string;
  booking_time: string;
  duration_minutes: number;
  status: string;
  created_at: string;
  connector_type?: string;
}

export interface CreateBookingRequest {
  station_id: number;
  connector_id?: number;
  booking_date: string;
  booking_time: string;
  duration_minutes: number;
}

export interface CancelBookingRequest {
  booking_id: number;
  reason?: string;
}

export const bookingService = {
  /**
   * Create a new booking
   */
  createBooking: async (data: CreateBookingRequest): Promise<Booking> => {
    const response = await apiClient.post<any>('/bookings/create', data, {
      requiresAuth: true,
    });
    return response.data;
  },

  /**
   * Get user bookings
   */
  getUserBookings: async (status?: string): Promise<Booking[]> => {
    let url = '/bookings/list';
    if (status) {
      url += `?status=${status}`;
    }
    const response = await apiClient.get<any>(url, { requiresAuth: true });
    return response.data.bookings;
  },

  /**
   * Get upcoming bookings
   */
  getUpcomingBookings: async (): Promise<Booking[]> => {
    const response = await apiClient.get<any>('/bookings/upcoming', {
      requiresAuth: true,
    });
    return response.data.bookings;
  },

  /**
   * Cancel a booking
   */
  cancelBooking: async (data: CancelBookingRequest): Promise<void> => {
    await apiClient.post<any>('/bookings/cancel', data, {
      requiresAuth: true,
    });
  },
};
