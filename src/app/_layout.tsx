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

import { useAuth, useSessionListener } from "@/hooks/useAuth";
import { useGlobalMessages } from "@/hooks/useGlobalMessages";
import { usePresence } from "@/hooks/usePresence";
import { registerForPushNotificationsAsync } from "@/services/notificationService";
import * as Notifications from "expo-notifications";
import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, StatusBar, View } from "react-native";

export default function RootLayout() {
  const { isInitialized, firebaseUser, user } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // 🔥 Wire up Firebase auth session listener — runs for entire app lifetime
  useSessionListener();

  // 🌐 Global background message listener — runs for entire app session
  useGlobalMessages();

  // 🟢 Online presence manager — monitors app state and internet connectivity
  usePresence();

  // 🔔 Register for push notifications when user is authenticated
  useEffect(() => {
    if (firebaseUser) {
      registerForPushNotificationsAsync(firebaseUser.uid);
    }
  }, [firebaseUser]);

  // 🔔 Listen for push notification taps and route to chat
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      const partnerUid = data?.senderUid ? String(data.senderUid) : '';
      const username = data?.senderName ? String(data.senderName) : 'Tea Friend';
      const photoURL = data?.partnerPhoto ? String(data.partnerPhoto) : 'null';
      const isOnline = data?.partnerOnline ? String(data.partnerOnline) : 'false';

      if (partnerUid) {
        router.push({
          pathname: '/chat/[id]',
          params: {
            id: partnerUid,
            username,
            photoURL,
            isOnline,
          },
        });
      }
    });

    return () => subscription.remove();
  }, [router]);

  useEffect(() => {
    if (!isInitialized) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inOnboardingGroup = segments[0] === "(onboarding)";
    const hasNiches = (user?.niches?.length ?? 0) >= 3;

    // Defer redirect to the next tick to ensure root navigator finishes mounting
    const timeout = setTimeout(() => {
      if (!firebaseUser && !inAuthGroup) {
        // Not signed in — send to auth screens
        router.replace("/(auth)");
      } else if (firebaseUser && inAuthGroup) {
        // Just signed in / signed up — check if niches are set
        if (hasNiches) {
          router.replace("/(tabs)/chats");
        } else {
          router.replace("/(onboarding)/niches");
        }
      } else if (firebaseUser && inOnboardingGroup && hasNiches) {
        // Onboarding just completed — niches saved, move to main app
        router.replace("/(tabs)/chats");
      }
    }, 0);

    return () => clearTimeout(timeout);
  }, [firebaseUser, user, isInitialized, segments]);

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
        <Stack.Screen name="(onboarding)" />
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
