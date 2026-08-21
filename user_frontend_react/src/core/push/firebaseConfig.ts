/**
 * Firebase web app config — port of DefaultFirebaseOptions.web in
 * lib/firebase_options.dart. Safe to commit: these are public client
 * identifiers, not secrets.
 *
 * MUST stay in sync with public/firebase-messaging-sw.js, which the browser
 * loads directly and so cannot read this module at runtime.
 */
export const firebaseConfig = {
  apiKey: 'AIzaSyCgLEO18ty76pZbWG_MxRUKHtBax5-hnl0',
  appId: '1:944780541276:web:466cc661b7e7b8874f1599',
  messagingSenderId: '944780541276',
  projectId: 'yesiki',
  authDomain: 'yesiki.firebaseapp.com',
  storageBucket: 'yesiki.firebasestorage.app',
  measurementId: 'G-W3ZVY9789N',
} as const;

/**
 * The Web Push certificate's public key, from Firebase Console ->
 * Project settings -> Cloud Messaging -> Web configuration -> Web Push
 * certificates. Safe to commit — like the apiKey, this is a public key, not
 * a secret. Required for getToken().
 */
export const webPushVapidKey: string =
  import.meta.env.VITE_FIREBASE_VAPID_KEY ??
  'BAwLy0NEpUW1w67gUSyV8A55GR6qbhEbxAptvfysE700fEweFDIFR0krPMa-pS0X8t8sVHebsMHPGV1HageIwv8';
