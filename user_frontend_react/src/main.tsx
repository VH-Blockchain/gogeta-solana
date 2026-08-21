// Must stay first: installs the Node globals the Solana libraries read at
// module-evaluation time, before any import below can pull them in.
import '@/core/polyfills';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PushNotifications } from '@/core/push/pushNotifications';
import { App } from './App';
import '@/theme/global.css';

/**
 * Boot. Firebase init is best-effort and awaited before the first render so
 * `PushNotifications.permissionStatus()` is meaningful on the Profile page's
 * first paint — it never throws, so a missing/blocked config just leaves push
 * disabled while everything else works normally.
 */
async function boot() {
  await PushNotifications.tryInitializeFirebase();

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void boot();
