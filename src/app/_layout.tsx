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
import { View, ActivityIndicator, StatusBar } from "react-native";
import { useGlobalMessages } from "@/hooks/useGlobalMessages";

export default function RootLayout() {
  const { useSessionListener, isInitialized, firebaseUser } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useSessionListener();

  // 🌐 Global background message listener — runs for entire app session
  useGlobalMessages();

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
      <View style={{ flex: 1, backgroundColor: '#0f150e', justifyContent: 'center', alignItems: 'center' }}>
        <StatusBar hidden />
        <ActivityIndicator size="large" color="#96f996" />
      </View>
    );
  }

  return (
    <>
      <StatusBar hidden />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="search"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="chat/[id]"
          options={{ animation: 'slide_from_right' }}
        />
      </Stack>
    </>
  );
}
