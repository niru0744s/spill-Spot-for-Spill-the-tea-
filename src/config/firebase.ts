/**
 * firebase.ts
 * -----------
 * Initializes the Firebase app ONCE and exports:
 *  - auth        : Firebase Auth (with React Native AsyncStorage persistence)
 *  - db          : Cloud Firestore
 *  - storage     : Firebase Storage
 *  - dataConnect : Firebase Data Connect
 *
 * Uses the modular Firebase JS SDK v12.
 * Type declarations for firebase/* submodules live in src/types/modules.d.ts.
 */

import { connectorConfig } from "@/dataconnect-generated";
import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  getReactNativePersistence,
  initializeAuth,
  type Auth,
} from "firebase/auth";
import { getDataConnect, type DataConnect } from "firebase/data-connect";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { authStorage } from "@/services/mmkv";

// ---------------------------------------------------------------------------
// Firebase project config — pulled from Expo env vars (EXPO_PUBLIC_ prefix)
// ---------------------------------------------------------------------------
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  shadowBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET, // fallback/unused
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// ---------------------------------------------------------------------------
// Guard: initialize the Firebase app only once
// (critical for React Native HMR / fast-refresh)
// ---------------------------------------------------------------------------

const app: FirebaseApp =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// ---------------------------------------------------------------------------
// Auth — initializeAuth with MMKV persistence so sessions survive
// app restarts. Falls back to getAuth if already initialized (hot-reload).
// ---------------------------------------------------------------------------
const mmkvAuthPersistence = {
  getItem: async (key: string) => {
    const val = authStorage.getString(key);
    return val !== undefined ? val : null;
  },
  setItem: async (key: string, value: string) => {
    authStorage.set(key, value);
  },
  removeItem: async (key: string) => {
    authStorage.remove(key);
  },
};

let auth: Auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(mmkvAuthPersistence),
  });
} catch {
  auth = getAuth(app);
}

const db: Firestore = getFirestore(app, "default");
const storage: FirebaseStorage = getStorage(app);
const dataConnect: DataConnect = getDataConnect(app, connectorConfig);

export { app, auth, dataConnect, db, storage };

