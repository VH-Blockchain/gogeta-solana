/**
 * Persists the JWT. Port of TokenStore — on web, flutter_secure_storage
 * itself falls back to browser storage, so this keeps the exact same key so
 * an existing Flutter-web session in the same origin stays readable.
 */
const KEY = 'gogeta_jwt';

export const TokenStore = {
  save(token: string): void {
    try {
      localStorage.setItem(KEY, token);
    } catch {
      /* storage disabled (private mode / blocked cookies) — session stays in-memory only */
    }
  },

  read(): string | null {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  },

  clear(): void {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* nothing persisted to clear */
    }
  },
};
