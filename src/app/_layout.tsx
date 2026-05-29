/**
 * _layout.tsx
 * -----------
 * Root layout — mounts the Firebase auth session listener so that
 * `onAuthStateChanged` is active for the entire app lifetime.
 *
 * The `isInitialized` flag from useAuth() lets you gate the navigator
 * until Firebase has resolved the persisted session (no flicker between
 * auth and non-auth screens on cold start).
 */

import { Stack } from "expo-router";
import { useAuth } from "@/hooks/useAuth";

export default function RootLayout() {
  const { useSessionListener, isInitialized } = useAuth();

  // Wire up onAuthStateChanged once at the root — this restores persisted
  // sessions and keeps isInitialized / user / firebaseUser in sync.
  useSessionListener();

  // Optional: return null (or a SplashScreen component) until Firebase has
  // resolved the session to prevent a flash of the wrong screen.
  if (!isInitialized) return null;

  return <Stack />;
}
