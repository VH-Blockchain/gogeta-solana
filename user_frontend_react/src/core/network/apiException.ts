/** A normalized API error the UI can show. Port of ApiException. */
export class ApiException extends Error {
  readonly statusCode?: number;

  /**
   * Machine-readable error code (e.g. "ACCOUNT_NOT_VERIFIED", "OTP_COOLDOWN")
   * when the backend sent one; undefined for plain validation/generic errors.
   */
  readonly code?: string;

  /**
   * The raw response body, so callers can read extra fields the backend
   * attaches alongside `code` (e.g. `retryAfterSeconds`, `email`).
   */
  readonly data?: Record<string, unknown>;

  constructor(
    message: string,
    opts: { statusCode?: number; code?: string; data?: Record<string, unknown> } = {},
  ) {
    super(message);
    this.name = 'ApiException';
    this.statusCode = opts.statusCode;
    this.code = opts.code;
    this.data = opts.data;
  }

  get isUnauthorized(): boolean {
    return this.statusCode === 401;
  }
}

/** Narrowing helper — `instanceof` across bundle boundaries can be brittle. */
export function isApiException(e: unknown): e is ApiException {
  return e instanceof ApiException || (e as ApiException)?.name === 'ApiException';
}
