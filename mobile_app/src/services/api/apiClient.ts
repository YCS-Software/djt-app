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
  const defaultUrl = 'http://3.110.84.196:5000/api';
  // const defaultUrl = 'http://localhost:5000/api';
  
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

// Per-request timeout so a half-open socket (e.g. WiFi↔mobile handoff) never
// hangs the UI forever (F2).
const REQUEST_TIMEOUT_MS = 15000;
// Dispatched once when the server rejects our token; the app listens and routes
// to /login (F9). Exported so listeners reference the same name.
export const AUTH_EXPIRED_EVENT = 'djt:auth-expired';

export type ApiErrorKind = 'offline' | 'timeout' | 'auth' | 'http' | 'parse' | 'network';

/**
 * Typed API error. Still a normal Error (message preserved), so existing
 * callers that read `e.message` keep working unchanged.
 */
export class ApiError extends Error {
  status?: number;
  kind: ApiErrorKind;
  constructor(message: string, kind: ApiErrorKind, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
  }
}

interface RequestOptions extends RequestInit {
  requiresAuth?: boolean;
}

class ApiClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private getHeaders(requiresAuth: boolean = false, hasBody = false): HeadersInit {
    const headers: HeadersInit = {};
    if (hasBody) headers['Content-Type'] = 'application/json';

    if (requiresAuth) {
      const token = localStorage.getItem('x-access-token');
      if (token) {
        headers['x-access-token'] = token;
      }
    }

    return headers;
  }

  // The token was rejected: clear the local session and let the app redirect.
  private handleAuthExpired() {
    try {
      localStorage.removeItem('x-access-token');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    } catch { /* ignore */ }
    try {
      window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
    } catch { /* SSR/no-window */ }
  }

  private async handleResponse<T>(response: Response, requiresAuth: boolean): Promise<T> {
    // Token rejected → central session-expiry handling (F9)
    if ((response.status === 401 || response.status === 403) && requiresAuth) {
      this.handleAuthExpired();
      throw new ApiError('Your session has expired. Please sign in again.', 'auth', response.status);
    }

    if (!response.ok) {
      let errorMessage = 'Something went wrong. Please try again.';
      try {
        const data = await response.json();
        errorMessage = data.message || errorMessage;
      } catch {
        errorMessage = `Request failed (${response.status})`;
      }
      throw new ApiError(errorMessage, 'http', response.status);
    }

    try {
      return (await response.json()) as T;
    } catch {
      throw new ApiError('Invalid response from server', 'parse', response.status);
    }
  }

  private async request<T>(
    method: string,
    endpoint: string,
    body: any | undefined,
    options: RequestOptions,
  ): Promise<T> {
    const { requiresAuth = false, signal, ...fetchOptions } = options;
    const hasBody = body !== undefined && method !== 'GET';

    // Timeout via AbortController; respect a caller-supplied signal too.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    if (signal) {
      if (signal.aborted) controller.abort();
      else signal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseURL}${endpoint}`, {
        method,
        headers: this.getHeaders(requiresAuth, hasBody),
        body: hasBody ? JSON.stringify(body) : undefined,
        signal: controller.signal,
        ...fetchOptions,
      });
    } catch (err: any) {
      if (controller.signal.aborted) {
        throw new ApiError('The request timed out. Check your connection and try again.', 'timeout');
      }
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
      throw new ApiError(
        offline ? 'You appear to be offline. Check your internet connection.' : 'Network error. Please try again.',
        offline ? 'offline' : 'network',
      );
    } finally {
      clearTimeout(timer);
    }

    return this.handleResponse<T>(response, requiresAuth);
  }

  async get<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('GET', endpoint, undefined, options);
  }

  async post<T>(endpoint: string, body?: any, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('POST', endpoint, body, options);
  }

  async put<T>(endpoint: string, body?: any, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('PUT', endpoint, body, options);
  }

  async delete<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('DELETE', endpoint, undefined, options);
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
