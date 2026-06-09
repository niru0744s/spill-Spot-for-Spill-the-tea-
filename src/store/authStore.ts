/**
 * authStore.ts
 * ------------
 * Zustand store for Firebase authentication state.
 *
 * This is the single source of truth for:
 *  - The raw Firebase `User` object (firebaseUser)
 *  - Our enriched Firestore user profile (user)
 *  - Loading / initialisation / error flags
 *
 * Pattern: useAuth hook reads from + writes to this store.
 * Any component can also read from this store directly via useAuthStore().
 */

import { create } from "zustand";
import type { User } from "firebase/auth";
import type { Timestamp } from "firebase/firestore";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  name: string;
  photoURL: string | null;
  isOnline: boolean;
  lastSeen: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  /**
   * Interest niches selected during onboarding (3–5 items).
   * If undefined or empty, the user hasn't completed niche onboarding yet.
   */
  niches?: string[];
}

interface AuthState {
  /** Enriched user profile from Firestore. Null when signed out. */
  user: UserProfile | null;
  /** Raw Firebase Auth user object. Null when signed out. */
  firebaseUser: User | null;
  /** True while any auth action (sign-in, sign-up, sign-out, fetch) is in flight. */
  isLoading: boolean;
  /**
   * Flips to `true` after `onAuthStateChanged` fires for the first time.
   * Use this to gate the splash screen / root navigator so you never show
   * the wrong screen before the session is resolved.
   */
  isInitialized: boolean;
  /** Last error message from any auth operation, or null. */
  error: string | null;
}

interface AuthActions {
  setUser: (user: UserProfile | null) => void;
  setFirebaseUser: (firebaseUser: User | null) => void;
  setLoading: (isLoading: boolean) => void;
  setInitialized: (isInitialized: boolean) => void;
  setError: (error: string | null) => void;
  /** Clears all auth state (used on sign-out). */
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const initialState: AuthState = {
  user: null,
  firebaseUser: null,
  isLoading: false,
  isInitialized: false,
  error: null,
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useAuthStore = create<AuthState & AuthActions>((set) => ({
  ...initialState,

  setUser: (user) => set({ user }),
  setFirebaseUser: (firebaseUser) => set({ firebaseUser }),
  setLoading: (isLoading) => set({ isLoading }),
  setInitialized: (isInitialized) => set({ isInitialized }),
  setError: (error) => set({ error }),

  reset: () => set({ ...initialState, isInitialized: true }),
}));
