/**
 * Backend base URL. Defaults to the live production API so demo/release
 * builds point at the server out of the box. Override per environment with
 * a `VITE_API_BASE` entry in `.env` (the Vite equivalent of the Flutter
 * build's `--dart-define=API_BASE`).
 *
 * Local development overrides:
 *  - same machine: http://localhost:4000/api
 *  - device on the LAN: your machine's LAN IP, e.g. http://192.168.1.36:4000/api
 */
export const ApiConfig = {
  baseUrl: import.meta.env.VITE_API_BASE ?? 'https://admin.yesiki.com/api',
} as const;
