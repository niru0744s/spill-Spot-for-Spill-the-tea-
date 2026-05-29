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
  sendEmailVerification,
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
      displayName: string
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

        // Send email verification using the Firebase console template
        await sendEmailVerification(fbUser).catch((e) => {
          console.warn("Failed to automatically send verification email:", e);
        });

        // 3. Build and write Firestore user document
        const now = Timestamp.now();
        const profile: UserProfile = {
          uid: fbUser.uid,
          email: fbUser.email ?? email,
          displayName,
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
   * Uploads a local image URI to Firebase Storage under `profile_photos/{uid}`,
   * then updates the Firestore profile and Firebase Auth photoURL.
   *
   * @param localUri - A local file URI (e.g. from expo-image-picker or expo-camera).
   * @returns The remote download URL on success, or null on failure.
   */
  const updateProfilePhoto = useCallback(
    async (localUri: string): Promise<string | null> => {
      if (!firebaseUser) {
        setError("You must be signed in to update your profile photo.");
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        // 1. Fetch the local image as a blob
        const response = await fetch(localUri);
        const blob = await response.blob();

        // 2. Build a Storage reference
        const photoRef = ref(
          storage,
          `profile_photos/${firebaseUser.uid}/avatar`
        );

        // 3. Upload with resumable upload for large images
        await new Promise<void>((resolve, reject) => {
          const uploadTask = uploadBytesResumable(photoRef, blob);
          uploadTask.on(
            "state_changed",
            null, // progress handler — hook callers can subscribe via Storage if needed
            (uploadError: Error) => reject(uploadError),
            () => resolve()
          );
        });

        // 4. Get the public download URL
        const downloadURL = await getDownloadURL(photoRef);

        // 5. Persist to Firestore + Firebase Auth
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
  // resendVerification
  // -------------------------------------------------------------------------
  const resendVerification = useCallback(async (): Promise<boolean> => {
    if (!auth.currentUser) {
      setError("No user is currently signed in.");
      return false;
    }
    setLoading(true);
    setError(null);
    try {
      await sendEmailVerification(auth.currentUser);
      return true;
    } catch (err) {
      setError(parseAuthError(err));
      return false;
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError]);

  // -------------------------------------------------------------------------
  // useSessionListener
  // -------------------------------------------------------------------------
  /**
   * Wires up Firebase's `onAuthStateChanged` listener.
   *
   * Call this ONCE at the root of your app (e.g. in `src/app/_layout.tsx`):
   *
   *   const { useSessionListener } = useAuth();
   *   useSessionListener();
   *
   * It will:
   *  - Restore a persisted session on cold start
   *  - Fetch the Firestore user profile automatically
   *  - Flip `isInitialized` so you can safely render the navigator
   *  - Clean up the listener on unmount
   */
  const useSessionListener = () => {
    useEffect(() => {
      const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
        if (fbUser) {
          setFirebaseUser(fbUser);

          try {
            // Mark online + update lastSeen on app open
            await updateDoc(doc(db, "users", fbUser.uid), {
              isOnline: true,
              lastSeen: serverTimestamp(),
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
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
  };

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

    // ── Verification ───────────────────────────────────────────────────────
    resendVerification,

    // ── Session ────────────────────────────────────────────────────────────
    useSessionListener,
  } as const;
}
