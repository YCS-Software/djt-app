/**
 * Authentication API Service
 */

import { apiClient } from './apiClient';
import { clearLastRoute } from '../appState';

export interface SendOTPRequest {
  phonenumber: string;
}

export interface SendOTPResponse {
  status: number;
  message: string;
  data: {
    otpID: string;
    usr_id: string;
    dev_otp?: string;
  };
}

export interface VerifyOTPRequest {
  phno: string;
  otp: string;
  otpID: string;
  usr_id: string;
}

export interface VerifyOTPResponse {
  status: number;
  message: string;
  token: string;
  data: {
    user: {
      usr_id: number;
      phn_nmbr_tx: string;
      nm_tx: string;
      eml_tx: string;
    };
  };
}

export type UserRole = 'customer' | 'owner';

export interface RegisterRequest {
  phone: string;
  name: string;
  email?: string | null;
  userType?: UserRole;
}

export interface RegisterResponse {
  status: number;
  message: string;
  data: {
    user: {
      usr_id: number;
      phone: string;
      name: string;
      email: string | null;
      userType: string;
      profileImage: string | null;
    };
    token: string;
  };
}

export const authService = {
  /**
   * Send OTP to phone number (for login)
   */
  sendOTP: async (phoneNumber: string): Promise<SendOTPResponse> => {
    return apiClient.post<SendOTPResponse>('/auth/app/otp', {
      phonenumber: phoneNumber,
    });
  },

  /**
   * Send OTP for signup (allows non-registered users)
   */
  sendSignupOTP: async (phoneNumber: string): Promise<SendOTPResponse> => {
    return apiClient.post<SendOTPResponse>('/auth/app/signup/otp', {
      phonenumber: phoneNumber,
    });
  },

  /**
   * Verify OTP and login
   */
  verifyOTP: async (data: VerifyOTPRequest): Promise<VerifyOTPResponse> => {
    return apiClient.post<VerifyOTPResponse>('/auth/app/verify/otp', data);
  },

  /**
   * Register new user
   */
  register: async (data: RegisterRequest): Promise<RegisterResponse> => {
    return apiClient.post<RegisterResponse>('/auth/register', data);
  },

  /**
   * Persist auth session (single source of truth for the token key)
   */
  saveSession: (token: string, user: any) => {
    localStorage.setItem('x-access-token', token);
    localStorage.setItem('user', JSON.stringify(user));
    // clean up the legacy key that an older signup flow used
    localStorage.removeItem('token');
  },

  /**
   * Logout user
   */
  logout: () => {
    localStorage.removeItem('x-access-token');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    // Forget the saved screen so a relaunch after logout doesn't restore a
    // previous session's route (it would be blocked anyway, but keep it clean).
    clearLastRoute();
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated: (): boolean => {
    return !!localStorage.getItem('x-access-token');
  },

  /**
   * Get current user from localStorage
   */
  getCurrentUser: () => {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },

  /**
   * Get the current user's role ('customer' | 'owner'), defaulting to 'customer'
   */
  getRole: (): UserRole => {
    try {
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      return user?.userType === 'owner' ? 'owner' : 'customer';
    } catch {
      return 'customer';
    }
  },

  /**
   * Landing route for the current role
   */
  homeRouteForRole: (): string => {
    return authService.getRole() === 'owner' ? '/owner' : '/home';
  },
};
