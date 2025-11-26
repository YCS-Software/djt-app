/**
 * API Client - Base HTTP client for all API calls
 */

import { Capacitor } from '@capacitor/core';

// Detect platform and set appropriate API URL
function getApiBaseUrl(): string {
  // Check for environment variable first
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  // If running in Capacitor (mobile app)
  if (Capacitor.isNativePlatform()) {
    // For Android emulator: use 10.0.2.2
    // For physical device: use your computer's local IP (e.g., 192.168.1.XXX)
    // For production: use your production API URL
    // TODO: Replace with your actual server IP or production URL
    return 'http://192.168.1.100:5000/api'; // Change this to your computer's IP
  }

  // For web development
  return 'http://localhost:5000/api';
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
