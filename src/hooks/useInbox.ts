/**
 * hooks/useInbox.ts
 * ------------------
 * Reads the local chat inbox from MMKV.
 *
 * - Instant (no network) — MMKV reads are synchronous and <1ms
 * - Call refresh() whenever you need to re-read (e.g. on focus)
 * - A chat appears here the moment saveChatMeta() is called,
 *   which happens on the first open of any chat screen.
 */

import { useState, useCallback, useEffect } from 'react';
import { getAllChats, getUnreadCount, type ChatMeta } from '@/services/chatStorage';
import { storage } from '@/services/mmkv';

export interface InboxItem extends ChatMeta {
  unreadCount: number;
}

export function useInbox() {
  const loadChats = useCallback((): InboxItem[] => {
    return getAllChats().map((meta) => ({
      ...meta,
      unreadCount: getUnreadCount(meta.chatId),
    }));
  }, []);

  const [chats, setChats] = useState<InboxItem[]>(() => loadChats());

  // Listen to MMKV updates in real-time
  useEffect(() => {
    const listener = storage.addOnValueChangedListener((key) => {
      // Refresh the list when index, metadata, badges, or message caches update
      if (
        key === 'chats_index' ||
        key.startsWith('chat_meta_') ||
        key.startsWith('unread_') ||
        key.startsWith('msgs_')
      ) {
        setChats(loadChats());
      }
    });

    return () => listener.remove();
  }, [loadChats]);

  /** Re-read from MMKV — call this on screen focus */
  const refresh = useCallback(() => {
    setChats(loadChats());
  }, [loadChats]);

  return { chats, refresh };
}
