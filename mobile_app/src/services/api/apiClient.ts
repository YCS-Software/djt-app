/**
 * API Client - Base HTTP client for all API calls
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

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
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'API request failed');
    }

    return data;
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
