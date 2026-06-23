/**
 * Payment Gateway API Service
 * Handles Razorpay payment integration
 */

import { apiClient } from './apiClient';

export interface CreateOrderRequest {
  amount: number;
  currency?: string;
  payment_method?: string;
}

export interface CreateOrderResponse {
  order_id: string;
  amount: number;
  currency: string;
  key_id: string;
  mock?: boolean;
}

export interface VerifyPaymentRequest {
  razorpay_order_id: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
}

export interface VerifyPaymentResponse {
  verified: boolean;
  order_id: string;
  payment_id: string | null;
  transaction_id?: number;
  amount?: number;
  new_balance?: number;
  already_processed?: boolean;
  mock?: boolean;
}

export const paymentService = {
  /**
   * Create payment order
   */
  createOrder: async (data: CreateOrderRequest): Promise<CreateOrderResponse> => {
    const response = await apiClient.post<any>('/payment/create-order', data, {
      requiresAuth: true,
    });
    return response.data;
  },

  /**
   * Verify payment
   */
  verifyPayment: async (data: VerifyPaymentRequest): Promise<VerifyPaymentResponse> => {
    const response = await apiClient.post<any>('/payment/verify', data, {
      requiresAuth: true,
    });
    return response.data;
  },
};

