/**
 * Authentication API Service
 */

import { apiClient } from './apiClient';

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

export interface RegisterRequest {
  phone: string;
  name: string;
  email?: string | null;
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
   * Logout user
   */
  logout: () => {
    localStorage.removeItem('x-access-token');
    localStorage.removeItem('user');
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
};
