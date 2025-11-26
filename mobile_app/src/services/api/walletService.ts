/**
 * Wallet API Service
 */

import { apiClient } from './apiClient';

export interface WalletBalance {
  wallet_id: number;
  balance: number;
  last_updated: string;
}

export interface Transaction {
  trxn_id: number;
  type: string;
  category: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  description: string;
  payment_method?: string;
  status: string;
  created_at: string;
}

export interface AddMoneyRequest {
  amount: number;
  payment_method: string;
  payment_details?: any;
}

export interface TransferMoneyRequest {
  to_phone: string;
  amount: number;
  note?: string;
}

export const walletService = {
  /**
   * Get wallet balance
   */
  getBalance: async (): Promise<WalletBalance> => {
    const response = await apiClient.get<any>('/wallet/balance', {
      requiresAuth: true,
    });
    return response.data;
  },

  /**
   * Add money to wallet
   */
  addMoney: async (data: AddMoneyRequest): Promise<any> => {
    const response = await apiClient.post<any>('/wallet/add-money', data, {
      requiresAuth: true,
    });
    return response.data;
  },

  /**
   * Get transaction history
   */
  getTransactions: async (limit = 50, offset = 0): Promise<Transaction[]> => {
    const response = await apiClient.get<any>(
      `/wallet/transactions?limit=${limit}&offset=${offset}`,
      { requiresAuth: true }
    );
    return response.data.transactions;
  },

  /**
   * Transfer money to another user
   */
  transferMoney: async (data: TransferMoneyRequest): Promise<any> => {
    const response = await apiClient.post<any>('/wallet/transfer', data, {
      requiresAuth: true,
    });
    return response.data;
  },
};
