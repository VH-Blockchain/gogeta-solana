// Thin fetch wrapper for the GOGETA backend: base URL + JWT bearer + JSON +
// normalized errors. Client-side only (token lives in localStorage).

const BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:4000/api';
const TOKEN_KEY = 'gogeta_admin_token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  /**
   * The backend's machine-readable `error` code, when it sent one. Callers that
   * need to branch on *which* failure this was — e.g. retrying a payout while
   * the chain is still confirming — read this instead of matching on `message`,
   * which is prose written for a human.
   */
  code: string | null;
  /** The parsed error body, for flags like `pending`. */
  data: Record<string, unknown> | null;

  constructor(
    message: string,
    status: number,
    code: string | null = null,
    data: Record<string, unknown> | null = null,
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

type Options = {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | undefined>;
};

export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  const { method = 'GET', body, query } = opts;
  const url = new URL(BASE + path);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
    }
  }

  const token = getToken();
  const res = await fetch(url.toString(), {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    let code: string | null = null;
    let data: Record<string, unknown> | null = null;
    try {
      const parsed = (await res.json()) as Record<string, unknown>;
      data = parsed;
      const m = parsed.message as string | string[] | undefined;
      if (m) message = Array.isArray(m) ? m.join(', ') : m;
      if (typeof parsed.error === 'string') code = parsed.error;
    } catch {
      /* ignore */
    }
    throw new ApiError(message, res.status, code, data);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Upload a file via multipart/form-data (field name `file`). Returns the JSON
 *  response (e.g. `{ url }` for image uploads, or an import summary). */
export async function uploadFile<T>(path: string, file: File, field = 'file'): Promise<T> {
  const form = new FormData();
  form.append(field, file);
  const token = getToken();
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
    cache: 'no-store',
  });
  if (!res.ok) {
    let message = `Upload failed (${res.status})`;
    try {
      const data = await res.json();
      const m = (data as { message?: string | string[] }).message;
      if (m) message = Array.isArray(m) ? m.join(', ') : m;
    } catch {
      /* ignore */
    }
    throw new ApiError(message, res.status);
  }
  return (await res.json()) as T;
}
