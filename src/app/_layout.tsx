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

import "@/errorHandler";
import { useAuth, useSessionListener } from "@/hooks/useAuth";
import { useGlobalMessages } from "@/hooks/useGlobalMessages";
import { usePresence } from "@/hooks/usePresence";
import { registerForPushNotificationsAsync } from "@/services/notificationService";
import { InAppBanner } from "@/components/InAppBanner";
import { CallScreen } from "@/components/CallScreen";
import { useCallStore, type CallType } from "@/store/useCallStore";
import { listenForIncomingCalls, startActiveCallListener } from "@/services/callService";
import * as Notifications from "expo-notifications";
import { Stack, useRouter, useSegments, useRootNavigationState } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, StatusBar, View } from "react-native";
import { ThemeProvider } from "@/context/ThemeContext";
import { useTheme } from "@/hooks/useTheme";

function RootLayoutContent() {
  const { isInitialized, firebaseUser, user } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();

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

  // 🔔 Listen for push notification taps and route to chat/call
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;

      // Handle incoming call notification taps
      if (data?.type === 'CALL_INCOMING' && data.callId) {
        useCallStore.getState().setCallActive({
          callId: String(data.callId),
          partnerUid: String(data.callerUid || ''),
          partnerName: String(data.callerName || 'Someone'),
          partnerPhoto: data.callerPhoto ? String(data.callerPhoto) : null,
          type: (data.callType as CallType) || 'voice',
          isIncoming: true,
          channelName: String(data.channelName || ''),
          agoraToken: String(data.agoraToken || ''),
        });
        startActiveCallListener(String(data.callId));
        return;
      }

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

  // 📞 Listen for incoming calls in real-time when authenticated
  useEffect(() => {
    if (!firebaseUser) return;

    const unsubscribe = listenForIncomingCalls(firebaseUser.uid, (callId) => {
      console.log('[RootLayout] Incoming call signaling registered:', callId);
    });

    return () => unsubscribe();
  }, [firebaseUser]);

  useEffect(() => {
    if (!isInitialized) return;
    if (!rootNavigationState?.key) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inOnboardingGroup = segments[0] === "(onboarding)";
    const hasNiches = (user?.niches?.length ?? 0) >= 3;

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
  }, [firebaseUser, user, isInitialized, segments, rootNavigationState?.key]);

  const { colors, isDark } = useTheme();

  if (!isInitialized) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
        <ActivityIndicator size="large" color={colors.primaryFixedDim} />
      </View>
    );
  }

  return (
    <>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
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
        <Stack.Screen
          name="settings"
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="transactions"
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="call-history"
          options={{ animation: 'slide_from_right' }}
        />
      </Stack>
      <InAppBanner />
      <CallScreen />
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootLayoutContent />
    </ThemeProvider>
  );
}
