/**
 * (auth)/_layout.tsx
 * ------------------
 * Layout wrapper for all authentication screens:
 *   index  → Landing page (Start Spilling / Sign In)
 *   login  → Sign In form
 *   signup → Create account form
 *
 * No header shown — auth screens manage their own visuals.
 */

import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login"  options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="signup" options={{ animation: 'slide_from_right' }} />
    </Stack>
  );
}
