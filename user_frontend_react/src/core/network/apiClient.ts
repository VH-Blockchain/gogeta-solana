import axios, { AxiosError, type AxiosInstance, type AxiosResponse } from 'axios';
import { ApiConfig } from './apiConfig';
import { ApiException } from './apiException';
import { TokenStore } from './tokenStore';

/**
 * Thin axios wrapper: base URL, JWT attach interceptor, and normalized
 * errors. Port of lib/core/network/api_client.dart.
 */
class ApiClientImpl {
  readonly http: AxiosInstance;

  constructor() {
    this.http = axios.create({
      baseURL: ApiConfig.baseUrl,
      // A request must never leave the UI loading forever — the Flutter
      // client enforced a hard 25s deadline on top of dio's own timeouts
      // because those are unreliable on the browser XHR/fetch adapter.
      timeout: 25_000,
      headers: { 'Content-Type': 'application/json' },
    });

    this.http.interceptors.request.use((config) => {
      const token = TokenStore.read();
      if (token) config.headers.Authorization = `Bearer ${token}`;
      return config;
    });
  }

  get<T = unknown>(path: string, query?: Record<string, unknown>): Promise<T> {
    return this.send<T>(() => this.http.get(path, { params: query }));
  }

  post<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.send<T>(() => this.http.post(path, body));
  }

  patch<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.send<T>(() => this.http.patch(path, body));
  }

  delete<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.send<T>(() => this.http.delete(path, { data: body }));
  }

  private async send<T>(run: () => Promise<AxiosResponse<T>>): Promise<T> {
    try {
      const res = await run();
      return res.data;
    } catch (e) {
      throw this.toApiException(e as AxiosError);
    }
  }

  private toApiException(e: AxiosError): ApiException {
    if (e.code === 'ECONNABORTED' || e.code === 'ETIMEDOUT') {
      return new ApiException('The server is taking too long. Please try again.');
    }

    const status = e.response?.status;
    const data = e.response?.data;
    let message = 'Something went wrong. Please try again.';
    let code: string | undefined;
    let dataMap: Record<string, unknown> | undefined;

    if (data && typeof data === 'object') {
      dataMap = data as Record<string, unknown>;
      const m = dataMap.message;
      if (m != null) message = Array.isArray(m) ? m.join(', ') : String(m);
      // Nest's default exception filter also puts a generic phrase like
      // "Bad Request"/"Forbidden" in `error` — only treat it as one of our
      // own machine codes when it looks like a SCREAMING_SNAKE_CASE id.
      const err = dataMap.error;
      if (typeof err === 'string' && /^[A-Z_]+$/.test(err)) code = err;
    } else if (!e.response) {
      message = 'Cannot reach the server. Check your connection.';
    }

    return new ApiException(message, { statusCode: status, code, data: dataMap });
  }
}

/**
 * Single shared instance. The Flutter app built this through a Provider
 * tree; on the React side one module-level client is the equivalent, and
 * every repository reads from it.
 */
export const ApiClient = new ApiClientImpl();
