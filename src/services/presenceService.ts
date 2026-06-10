/**
 * services/presenceService.ts
 * ----------------------------
 * Handles online presence status updates and lease-based calculations.
 * Encapsulated service to make presence management modular.
 */

import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';

export const PRESENCE_STALE_THRESHOLD = 3 * 60 * 1000; // 3 minutes in milliseconds

/**
 * Robustly converts any Firestore timestamp format (Timestamp, serialized object, Date, number, ISO string) into Unix ms
 */
export function getMillis(timestamp: any): number {
  if (!timestamp) return 0;
  if (typeof timestamp === 'number') return timestamp;
  if (typeof timestamp.toMillis === 'function') return timestamp.toMillis();
  
  // Handle deserialized Firestore timestamps from JSON/MMKV
  if (timestamp.seconds !== undefined) {
    return timestamp.seconds * 1000 + Math.floor((timestamp.nanoseconds ?? 0) / 1000000);
  }
  
  if (typeof timestamp.toDate === 'function') return timestamp.toDate().getTime();
  
  const date = new Date(timestamp);
  const ms = date.getTime();
  return isNaN(ms) ? 0 : ms;
}

/**
 * Updates a user's presence document in Firestore.
 * Updates isOnline, lastSeen, and updatedAt.
 */
export async function setUserOnlineStatus(uid: string, isOnline: boolean): Promise<void> {
  if (!uid) return;
  try {
    const userDocRef = doc(db, 'users', uid);
    await updateDoc(userDocRef, {
      isOnline,
      lastSeen: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.warn('[presenceService] Failed to update online status in Firestore:', error);
  }
}

/**
 * Verifies if a user is online based on their document isOnline flag AND lastSeen lease
 */
export function isUserOnline(lastSeen: any, isOnlineField: boolean): boolean {
  if (!isOnlineField) return false;
  const lastSeenMs = getMillis(lastSeen);
  if (lastSeenMs === 0) return false;
  return Date.now() - lastSeenMs < PRESENCE_STALE_THRESHOLD;
}

/**
 * Returns a user-friendly presence label for a user's online status.
 */
export function getPresenceLabel(
  lastSeen: any,
  isOnlineField: boolean,
  activeChatId: string | null = null,
  currentChatId: string | null = null
): string {
  const online = isUserOnline(lastSeen, isOnlineField);
  
  if (online) {
    if (activeChatId && currentChatId && activeChatId === currentChatId) {
      return 'on chat';
    }
    return 'Active now';
  }

  const lastSeenMs = getMillis(lastSeen);
  if (lastSeenMs === 0) return 'Offline';

  const diffMs = Date.now() - lastSeenMs;
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);

  if (mins < 1) {
    return 'Active just now';
  }
  if (mins < 60) {
    return `Active ${mins}m ago`;
  }
  if (hours < 24) {
    return `Active ${hours}h ago`;
  }
  return 'Offline';
}
