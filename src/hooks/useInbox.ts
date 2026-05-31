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

import { useState, useCallback } from 'react';
import { getAllChats, getUnreadCount, type ChatMeta } from '@/services/chatStorage';

export interface InboxItem extends ChatMeta {
  unreadCount: number;
}

export function useInbox() {
  const [chats, setChats] = useState<InboxItem[]>(() => loadChats());

  function loadChats(): InboxItem[] {
    return getAllChats().map((meta) => ({
      ...meta,
      unreadCount: getUnreadCount(meta.chatId),
    }));
  }

  /** Re-read from MMKV — call this on screen focus */
  const refresh = useCallback(() => {
    setChats(loadChats());
  }, []);

  return { chats, refresh };
}
