/**
 * useAuth.ts
 * ----------
 * Firebase Authentication hook for the Spill chat app.
 *
 * Exposes:
 *  State (from Zustand authStore)
 *    user            — Enriched Firestore UserProfile | null
 *    firebaseUser    — Raw Firebase User | null
 *    isLoading       — True while any auth operation is in flight
 *    isInitialized   — True after the first onAuthStateChanged callback fires
 *    error           — Last error message | null
 *
 *  Auth Actions
 *    signUp(email, password, displayName)  — Register + create Firestore profile
 *    signIn(email, password)               — Sign in + fetch Firestore profile
 *    signOut()                             — Sign out + reset store
 *
 *  Profile Actions
 *    fetchUserProfile(uid)                 — Fetch /users/{uid} doc
 *    updateProfile(data)                   — Update Firestore doc + Firebase Auth profile
 *    updateProfilePhoto(localUri)          — Upload image → Storage → update Firestore + Auth
 *
 *  Session Management
 *    useSessionListener()                  — Call once at the app root to wire up
 *                                            onAuthStateChanged and restore sessions.
 *
 * Firebase SDK: v12 modular API
 * Zustand: v5
 */

import { useEffect, useCallback } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile as updateFirebaseProfile,
  type User,
} from "firebase/auth";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from "firebase/storage";

import { auth, db, storage } from "@/config/firebase";
import { useAuthStore, type UserProfile } from "@/store/authStore";
import { uploadProfilePhotoToSupabase } from "@/services/supabaseService";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Maps a raw Firebase error code to a human-readable message.
 * Extend this switch as you add more auth flows.
 */
function parseAuthError(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error
  ) {
    const code = (error as { code: string }).code;
    switch (code) {
      case "auth/email-already-in-use":
        return "That email is already in use. Try signing in instead.";
      case "auth/invalid-email":
        return "Please enter a valid email address.";
      case "auth/weak-password":
        return "Password should be at least 6 characters.";
      case "auth/wrong-password":
      case "auth/invalid-credential":
        return "Incorrect email or password. Please try again.";
      case "auth/user-not-found":
        return "No account found with that email.";
      case "auth/too-many-requests":
        return "Too many attempts. Please try again later.";
      case "auth/network-request-failed":
        return "Network error. Check your connection and try again.";
      default:
        return `Something went wrong (${code}). Please try again.`;
    }
  }
  return "An unexpected error occurred. Please try again.";
}

/**
 * Fetches the /users/{uid} document from Firestore and returns it as
 * a UserProfile. Returns null if the document does not exist.
 */
async function fetchProfileDoc(uid: string): Promise<UserProfile | null> {
  const docRef = doc(db, "users", uid);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return snap.data() as UserProfile;
}

// ---------------------------------------------------------------------------
// useAuth hook
// ---------------------------------------------------------------------------

export function useAuth() {
  // ---------- Store selectors ----------
  const user = useAuthStore((s) => s.user);
  const firebaseUser = useAuthStore((s) => s.firebaseUser);
  const isLoading = useAuthStore((s) => s.isLoading);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const error = useAuthStore((s) => s.error);

  const setUser = useAuthStore((s) => s.setUser);
  const setFirebaseUser = useAuthStore((s) => s.setFirebaseUser);
  const setLoading = useAuthStore((s) => s.setLoading);
  const setInitialized = useAuthStore((s) => s.setInitialized);
  const setError = useAuthStore((s) => s.setError);
  const reset = useAuthStore((s) => s.reset);

  // -------------------------------------------------------------------------
  // signUp
  // -------------------------------------------------------------------------
  const signUp = useCallback(
    async (
      email: string,
      password: string,
      displayName: string,
      name: string
    ): Promise<UserProfile | null> => {
      setLoading(true);
      setError(null);

      try {
        // 1. Create Firebase Auth user
        const credential = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );
        const fbUser: User = credential.user;

        // 2. Persist displayName in Firebase Auth profile
        await updateFirebaseProfile(fbUser, { displayName });

        // 3. Build and write Firestore user document
        const now = Timestamp.now();
        const profile: UserProfile = {
          uid: fbUser.uid,
          email: fbUser.email ?? email,
          displayName,
          name,
          photoURL: null,
          isOnline: true,
          lastSeen: now,
          createdAt: now,
          updatedAt: now,
        };

        await setDoc(doc(db, "users", fbUser.uid), {
          ...profile,
          // Use server timestamps for canonical creation time
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastSeen: serverTimestamp(),
        });

        // 4. Update store
        setFirebaseUser(fbUser);
        setUser(profile);

        return profile;
      } catch (err) {
        const message = parseAuthError(err);
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError, setFirebaseUser, setUser]
  );

  // -------------------------------------------------------------------------
  // signIn
  // -------------------------------------------------------------------------
  const signIn = useCallback(
    async (email: string, password: string): Promise<UserProfile | null> => {
      setLoading(true);
      setError(null);

      try {
        // 1. Sign in with Firebase Auth
        const credential = await signInWithEmailAndPassword(
          auth,
          email,
          password
        );
        const fbUser: User = credential.user;

        // 2. Mark user as online + update lastSeen in Firestore
        const userDocRef = doc(db, "users", fbUser.uid);
        await updateDoc(userDocRef, {
          isOnline: true,
          lastSeen: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        // 3. Fetch full profile from Firestore
        const profile = await fetchProfileDoc(fbUser.uid);

        // 4. Update store
        setFirebaseUser(fbUser);
        setUser(profile);

        return profile;
      } catch (err) {
        const message = parseAuthError(err);
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError, setFirebaseUser, setUser]
  );

  // -------------------------------------------------------------------------
  // signOut
  // -------------------------------------------------------------------------
  const signOut = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      // Mark user as offline before signing out (best-effort)
      if (firebaseUser) {
        await updateDoc(doc(db, "users", firebaseUser.uid), {
          isOnline: false,
          lastSeen: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }).catch(() => {
          // Silently ignore — the user might be offline
        });
      }

      await firebaseSignOut(auth);
      reset(); // Clears store; keeps isInitialized: true
    } catch (err) {
      setError(parseAuthError(err));
    } finally {
      setLoading(false);
    }
  }, [firebaseUser, setLoading, setError, reset]);

  // -------------------------------------------------------------------------
  // fetchUserProfile
  // -------------------------------------------------------------------------
  const fetchUserProfile = useCallback(
    async (uid: string): Promise<UserProfile | null> => {
      setLoading(true);
      setError(null);

      try {
        const profile = await fetchProfileDoc(uid);
        if (profile) setUser(profile);
        return profile;
      } catch (err) {
        setError(parseAuthError(err));
        return null;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError, setUser]
  );

  // -------------------------------------------------------------------------
  // updateProfile
  // -------------------------------------------------------------------------
  const updateProfile = useCallback(
    async (
      data: Partial<Pick<UserProfile, "displayName" | "photoURL">>
    ): Promise<void> => {
      if (!firebaseUser) {
        setError("You must be signed in to update your profile.");
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // 1. Update Firestore
        await updateDoc(doc(db, "users", firebaseUser.uid), {
          ...data,
          updatedAt: serverTimestamp(),
        });

        // 2. Sync with Firebase Auth profile (displayName & photoURL)
        const authUpdate: { displayName?: string; photoURL?: string | null } =
          {};
        if (data.displayName !== undefined)
          authUpdate.displayName = data.displayName;
        if (data.photoURL !== undefined) authUpdate.photoURL = data.photoURL;
        if (Object.keys(authUpdate).length > 0) {
          await updateFirebaseProfile(firebaseUser, authUpdate);
        }

        // 3. Re-fetch and update store
        const updated = await fetchProfileDoc(firebaseUser.uid);
        if (updated) setUser(updated);
      } catch (err) {
        setError(parseAuthError(err));
      } finally {
        setLoading(false);
      }
    },
    [firebaseUser, setLoading, setError, setUser]
  );

  // -------------------------------------------------------------------------
  // updateProfilePhoto
  // -------------------------------------------------------------------------
  /**
   * Uploads a base64 image string to Supabase Storage under `avatars/{uid}_avatar.jpg`,
   * then updates the Firestore profile and Firebase Auth photoURL.
   *
   * @param base64Data - The base64 data string of the picked image.
   * @returns The remote download URL on success, or null on failure.
   */
  const updateProfilePhoto = useCallback(
    async (base64Data: string): Promise<string | null> => {
      if (!firebaseUser) {
        setError("You must be signed in to update your profile photo.");
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        // 1. Upload directly to Supabase Storage via lightweight fetch using base64 data
        const downloadURL = await uploadProfilePhotoToSupabase(base64Data, firebaseUser.uid);
        if (!downloadURL) {
          throw new Error("Failed to get public download URL from Supabase Storage.");
        }

        // 2. Persist to Firestore + Firebase Auth
        await updateProfile({ photoURL: downloadURL });

        return downloadURL;
      } catch (err) {
        setError(parseAuthError(err));
        return null;
      } finally {
        setLoading(false);
      }
    },
    [firebaseUser, setLoading, setError, updateProfile]
  );

  // -------------------------------------------------------------------------
  // saveNiches
  // -------------------------------------------------------------------------
  /**
   * Persists the user's selected interest niches to Firestore `/users/{uid}`.
   * Called once after the onboarding niche selection screen completes.
   *
   * @param niches - Array of niche strings (3–5 items).
   */
  const saveNiches = useCallback(
    async (niches: string[]): Promise<void> => {
      if (!firebaseUser) {
        setError("You must be signed in to save your niches.");
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // 1. Write niches + updatedAt to Firestore
        await updateDoc(doc(db, "users", firebaseUser.uid), {
          niches,
          updatedAt: serverTimestamp(),
        });

        // 2. Update store optimistically — only `niches` changed, no need to
        //    re-fetch the entire profile document (saves one Firestore read).
        //    Use getState() to avoid a stale-closure on the `user` variable.
        const current = useAuthStore.getState().user;
        if (current) setUser({ ...current, niches });
      } catch (err) {
        setError(parseAuthError(err));
      } finally {
        setLoading(false);
      }
    },
    [firebaseUser, setLoading, setError, setUser]
  );

  // -------------------------------------------------------------------------
  // Return public API
  // -------------------------------------------------------------------------
  return {
    // ── State ─────────────────────────────────────────────────────────────
    user,
    firebaseUser,
    isLoading,
    isInitialized,
    error,

    // ── Auth Actions ───────────────────────────────────────────────────────
    signUp,
    signIn,
    signOut,

    // ── Profile Actions ────────────────────────────────────────────────────
    fetchUserProfile,
    updateProfile,
    updateProfilePhoto,
    saveNiches,
  } as const;
}

// ---------------------------------------------------------------------------
// useSessionListener — standalone hook (React-rules-compliant)
// ---------------------------------------------------------------------------
/**
 * Wires up Firebase's `onAuthStateChanged` listener.
 *
 * Call this ONCE at the top level of your root component:
 *
 *   import { useSessionListener } from '@/hooks/useAuth';
 *   // inside RootLayout:
 *   useSessionListener();
 *
 * Behaviour:
 *  - Restores a persisted session on cold start
 *  - Fetches the Firestore user profile automatically
 *  - Marks the user online + updates lastSeen
 *  - Flips `isInitialized` so the navigator can safely render
 *  - Cleans up the Firebase listener on unmount
 *
 * Extracted from useAuth() so that useEffect is called at the top
 * level of a proper hook — satisfying React's Rules of Hooks.
 */
export function useSessionListener(): void {
  // Access store setters directly — no circular dependency with useAuth()
  const setFirebaseUser = useAuthStore((s) => s.setFirebaseUser);
  const setUser         = useAuthStore((s) => s.setUser);
  const setInitialized  = useAuthStore((s) => s.setInitialized);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        setFirebaseUser(fbUser);

        try {
          // Mark online + update lastSeen on app open
          await updateDoc(doc(db, 'users', fbUser.uid), {
            isOnline:  true,
            lastSeen:  serverTimestamp(),
            updatedAt: serverTimestamp(),
          }).catch(() => {
            // Silently ignore if the doc doesn't exist yet (race on signup)
          });

          const profile = await fetchProfileDoc(fbUser.uid);
          setUser(profile);
        } catch {
          // Profile fetch failed — user is still authenticated
          setUser(null);
        }
      } else {
        // Signed out or no persisted session
        setFirebaseUser(null);
        setUser(null);
      }

      // Always flip initialized after first callback, regardless of outcome
      setInitialized(true);
    });

    return () => unsubscribe();
  // Store setter references from Zustand are stable — no need to list them
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
