/**
 * API Client - Base HTTP client for all API calls
 */

import { Capacitor } from '@capacitor/core';

// Detect platform and set appropriate API URL
function getApiBaseUrl(): string {
  // Priority 1: Check for environment variable (set during build)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  // Priority 2: Check for Capacitor config (for runtime override)
  if (Capacitor.isNativePlatform()) {
    // You can also set this in capacitor.config.ts
    const capacitorConfig = (window as any).Capacitor?.getPlatform()?.config;
    if (capacitorConfig?.server?.url) {
      return capacitorConfig.server.url;
    }
  }

  // Priority 3: Fallback to default
  // For Android emulator: use 10.0.2.2 instead of localhost
  // For physical device: use your computer's local IP (e.g., 192.168.1.XXX)
  // For production: use your production API URL
  const defaultUrl = 'http://13.202.34.243:5001/api';
  
  if (Capacitor.isNativePlatform()) {
    // Check if running on Android emulator
    const platform = Capacitor.getPlatform();
    if (platform === 'android') {
      // You can detect emulator vs physical device here if needed
      return defaultUrl;
    }
  }

  // For web development
  return defaultUrl;
}

const API_BASE_URL = getApiBaseUrl();

interface RequestOptions extends RequestInit {
  requiresAuth?: boolean;
}

class ApiClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private getHeaders(requiresAuth: boolean = false): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (requiresAuth) {
      const token = localStorage.getItem('x-access-token');
      if (token) {
        headers['x-access-token'] = token;
      }
    }

    return headers;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    // Handle network errors
    if (!response.ok) {
      let errorMessage = 'API request failed';
      try {
        const data = await response.json();
        errorMessage = data.message || errorMessage;
      } catch (e) {
        errorMessage = `Network error: ${response.status} ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }

    try {
      const data = await response.json();
      return data;
    } catch (e) {
      throw new Error('Invalid response from server');
    }
  }

  async get<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { requiresAuth = false, ...fetchOptions } = options;

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'GET',
      headers: this.getHeaders(requiresAuth),
      ...fetchOptions,
    });

    return this.handleResponse<T>(response);
  }

  async post<T>(
    endpoint: string,
    body?: any,
    options: RequestOptions = {}
  ): Promise<T> {
    const { requiresAuth = false, ...fetchOptions } = options;

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'POST',
      headers: this.getHeaders(requiresAuth),
      body: JSON.stringify(body),
      ...fetchOptions,
    });

    return this.handleResponse<T>(response);
  }

  async put<T>(
    endpoint: string,
    body?: any,
    options: RequestOptions = {}
  ): Promise<T> {
    const { requiresAuth = false, ...fetchOptions } = options;

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'PUT',
      headers: this.getHeaders(requiresAuth),
      body: JSON.stringify(body),
      ...fetchOptions,
    });

    return this.handleResponse<T>(response);
  }

  async delete<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { requiresAuth = false, ...fetchOptions } = options;

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'DELETE',
      headers: this.getHeaders(requiresAuth),
      ...fetchOptions,
    });

    return this.handleResponse<T>(response);
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
