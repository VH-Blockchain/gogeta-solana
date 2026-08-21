// Runs in its own isolated service-worker context — the browser loads this
// file directly, so it can't read app config at runtime. Values below are
// copied from src/core/push/firebaseConfig.ts and must be updated by hand if
// that ever changes.
// Handles a push arriving while no tab is open/focused; a foregrounded tab
// instead gets it via onMessage in the app.
importScripts('https://www.gstatic.com/firebasejs/12.15.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.15.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyCgLEO18ty76pZbWG_MxRUKHtBax5-hnl0',
  appId: '1:944780541276:web:466cc661b7e7b8874f1599',
  messagingSenderId: '944780541276',
  projectId: 'yesiki',
  authDomain: 'yesiki.firebaseapp.com',
  storageBucket: 'yesiki.firebasestorage.app',
});

firebase.messaging();

// Compat SDK auto-shows a notification for a background push using its
// `notification` payload; this only handles what happens on tap — same
// type -> route mapping as navigateForWebPushType in src/core/push/.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const routesByType = {
    LUCKY: '/leaderboard/lucky',
    RESULT: '/predictions',
    SYSTEM: '/notifications',
  };
  const type = event.notification?.data?.FCM_MSG?.data?.type;
  const path = routesByType[type] || '/dashboard';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(path);
          return client.focus();
        }
      }
      return self.clients.openWindow(path);
    }),
  );
});
