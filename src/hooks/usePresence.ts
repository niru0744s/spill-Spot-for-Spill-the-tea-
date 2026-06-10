/**
 * hooks/usePresence.ts
 * ---------------------
 * Hook to manage the online presence state machine.
 * Monitors AppState (active/backgrounded) and NetInfo (connected/offline) changes
 * and writes to Firestore.
 */

import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useAuthStore } from '@/store/authStore';
import { setUserOnlineStatus } from '@/services/presenceService';

export function usePresence(): void {
  const firebaseUser = useAuthStore((s) => s.firebaseUser);
  const uid = firebaseUser?.uid;
  
  const lastStatusRef = useRef<boolean | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!uid) {
      lastStatusRef.current = null;
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
      return;
    }

    const startHeartbeat = () => {
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = setInterval(() => {
        if (uid && lastStatusRef.current === true) {
          setUserOnlineStatus(uid, true).catch(() => {});
        }
      }, 60000);
    };

    const stopHeartbeat = () => {
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
    };

    const updateStatus = (online: boolean) => {
      if (lastStatusRef.current === online) return;
      lastStatusRef.current = online;
      setUserOnlineStatus(uid, online);
      if (online) {
        startHeartbeat();
      } else {
        stopHeartbeat();
      }
    };

    // 1. Initial connect — set user online immediately
    updateStatus(true);

    // 2. Listen to AppState transitions
    const appStateSubscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        // Re-check internet before going online
        NetInfo.fetch().then((state) => {
          if (state.isConnected) {
            updateStatus(true);
          } else {
            updateStatus(false);
          }
        });
      } else {
        updateStatus(false);
      }
    });

    // 3. Listen to network connection updates (NetInfo)
    const unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      const isConnected = state.isConnected ?? false;
      if (!isConnected) {
        updateStatus(false);
      } else {
        // Connection restored — mark online only if app is currently active
        const isCurrentActive = AppState.currentState === 'active';
        updateStatus(isCurrentActive);
      }
    });

    return () => {
      appStateSubscription.remove();
      unsubscribeNetInfo();
      stopHeartbeat();
      
      // Best-effort cleanup on unmount
      if (uid) {
        setUserOnlineStatus(uid, false).catch(() => {});
      }
    };
  }, [uid]);
}
export default usePresence;
