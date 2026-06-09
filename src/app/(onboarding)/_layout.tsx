/**
 * (onboarding)/_layout.tsx
 * ------------------------
 * Minimal stack wrapper for the onboarding flow.
 * headerShown: false so each screen owns its full canvas.
 */

import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
  );
}
