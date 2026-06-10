import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Triggers a light tactile feedback pulse.
 */
export function triggerLightImpact(): void {
  if (Platform.OS === 'web') return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/**
 * Triggers a medium tactile feedback pulse (useful for sends, receives, etc.).
 */
export function triggerMediumImpact(): void {
  if (Platform.OS === 'web') return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

/**
 * Triggers a heavy tactile feedback pulse (ideal for long-presses).
 */
export function triggerHeavyImpact(): void {
  if (Platform.OS === 'web') return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
}

/**
 * Triggers a double-pulse tactile feedback indicating a successful operation.
 */
export function triggerSuccessNotification(): void {
  if (Platform.OS === 'web') return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

/**
 * Triggers a subtle tactile feedback indicating selection change.
 */
export function triggerSelection(): void {
  if (Platform.OS === 'web') return;
  Haptics.selectionAsync().catch(() => {});
}
