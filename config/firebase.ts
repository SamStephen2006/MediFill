import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getAuth, inMemoryPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Keys are loaded from environment variables (.env file, git-ignored).
// See .env.example for the required variable names.
const firebaseConfig = {
  apiKey:            process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId:     process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// ── App ───────────────────────────────────────────────────────────────────────
// Guard against duplicate initialization (Fast Refresh / hot reload)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// ── Auth ───────────────────────────────────────────────────────────────────────
let auth: ReturnType<typeof getAuth>;
try {
  auth = initializeAuth(app, {
    persistence: inMemoryPersistence,
  });
} catch {
  // initializeAuth was already called (e.g. hot reload) — reuse existing instance
  auth = getAuth(app);
}

// ── Firestore ─────────────────────────────────────────────────────────────────
const db = getFirestore(app);

export { app, auth, db };
