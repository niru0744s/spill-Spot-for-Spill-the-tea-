/**
 * useCallPermissions.ts
 * ---------------------
 * Hook to request hardware permissions (camera & microphone)
 * required for voice & video calling.
 *
 * Uses the same Expo permission APIs as the rest of the app:
 *   - expo-audio  → requestRecordingPermissionsAsync  (same as voice messages)
 *   - expo-image-picker → requestCameraPermissionsAsync (same as photo capture)
 *
 * This is the only correct way to trigger the native OS permission dialog
 * in the Expo managed workflow across iOS, Android, and Web.
 */

import { requestRecordingPermissionsAsync } from 'expo-audio';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';

export function useCallPermissions() {
  const [hasPermissions, setHasPermissions] = useState<boolean | null>(null);

  const requestPermissions = useCallback(async (type: 'voice' | 'video'): Promise<boolean> => {
    try {
      // 1. Always request microphone permission (required for both voice & video)
      const micResult = await requestRecordingPermissionsAsync();
      if (!micResult.granted) {
        console.warn('[useCallPermissions] Microphone permission denied.');
        setHasPermissions(false);
        return false;
      }

      // 2. Request camera permission only for video calls
      if (type === 'video') {
        const camResult = await ImagePicker.requestCameraPermissionsAsync();
        if (!camResult.granted) {
          console.warn('[useCallPermissions] Camera permission denied.');
          setHasPermissions(false);
          return false;
        }
      }

      setHasPermissions(true);
      return true;
    } catch (err) {
      console.error('[useCallPermissions] Failed to request permissions:', err);
      setHasPermissions(false);
      return false;
    }
  }, []);

  return { hasPermissions, requestPermissions };
}
