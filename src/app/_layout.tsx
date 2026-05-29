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

import { Stack, useRouter, useSegments } from "expo-router";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";

export default function RootLayout() {
  const { useSessionListener, isInitialized, firebaseUser } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useSessionListener();

  useEffect(() => {
    if (!isInitialized) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!firebaseUser && !inAuthGroup) {
      // Redirect to login page if unauthenticated and not already in auth group
      router.replace("/(auth)");
    } else if (firebaseUser && inAuthGroup) {
      // Redirect to main app if authenticated and trying to access auth screens
      router.replace("/(tabs)/chats");
    }
  }, [firebaseUser, isInitialized, segments]);

  if (!isInitialized) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0F2027', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#38bdf8" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
