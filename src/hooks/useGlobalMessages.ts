/**
 * hooks/useGlobalMessages.ts
 * ---------------------------
 * App-level background listener. Mounts once in _layout.tsx.
 *
 * Watches: /users/{currentUid}/inbox
 *
 * When a partner sends a message they also write to this inbox doc.
 * This hook picks it up and:
 *   1. Saves / updates the ChatMeta in MMKV (for the inbox preview)
 *   2. Fetches the actual unread messages from Firestore and saves to MMKV
 *   3. Increments the unread badge (unless the user already has that chat open)
 *
 * This way messages arrive even when the chat screen is not mounted.
 */

import { useEffect, useRef } from 'react';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  getDocs,
  limit,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, auth } from '@/config/firebase';
import {
  saveChatMeta,
  appendMessage,
  incrementUnread,
  getMessages,
  type StoredMessage,
} from '@/services/chatStorage';
import { getActiveChatId } from '@/services/activeChat';
import { markMessageDelivered } from '@/services/messageService';

export function useGlobalMessages() {
  const currentUid  = auth.currentUser?.uid ?? '';
  // Track per-chat message listeners so we don't double-attach
  const chatUnsubsRef = useRef<Map<string, Unsubscribe>>(new Map());

  useEffect(() => {
    if (!currentUid) return;

    // ── Watch the user's inbox for new/updated chats ──────────────────────
    const inboxRef = collection(db, 'users', currentUid, 'inbox');
    const inboxQuery = query(inboxRef, orderBy('lastMessageAt', 'desc'));

    const unsubInbox = onSnapshot(inboxQuery, (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type !== 'added' && change.type !== 'modified') return;

        const data   = change.doc.data();
        const chatId = change.doc.id;

        // 1️⃣ Update / register chat metadata in MMKV
        const lastAt = data.lastMessageAt instanceof Timestamp
          ? data.lastMessageAt.toMillis()
          : Date.now();

        saveChatMeta({
          chatId,
          partnerUid:    data.partnerUid   ?? '',
          partnerName:   data.partnerName  ?? 'Unknown',
          partnerPhoto:  data.partnerPhoto ?? null,
          partnerOnline: false,              // presence handled separately
          lastMessage:   data.lastMessage  ?? '',
          lastMessageAt: lastAt,
          isBackedUp:    false,
        });

        // 2️⃣ Attach a messages listener for this chat (if not already attached)
        if (!chatUnsubsRef.current.has(chatId)) {
          attachChatListener(chatId, currentUid, chatUnsubsRef.current);
        }
      });
    });

    return () => {
      unsubInbox();
      // Detach all per-chat listeners on unmount
      chatUnsubsRef.current.forEach(unsub => unsub());
      chatUnsubsRef.current.clear();
    };
  }, [currentUid]);
}

// ---------------------------------------------------------------------------
// Attaches a real-time messages listener for one specific chat.
// Runs in the background — not tied to any screen.
// ---------------------------------------------------------------------------

function attachChatListener(
  chatId: string,
  currentUid: string,
  registry: Map<string, Unsubscribe>
): void {
  const msgsRef  = collection(db, 'chats', chatId, 'messages');
  const msgsQuery = query(msgsRef, orderBy('createdAt', 'asc'));

  const unsub = onSnapshot(msgsQuery, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type !== 'added') return;

      const data  = change.doc.data();
      const msgId = change.doc.id;

      // Skip own messages
      if (data.senderUid === currentUid) return;

      const createdAt = data.createdAt instanceof Timestamp
        ? data.createdAt.toMillis()
        : Date.now();

      const msg: StoredMessage = {
        id:        msgId,
        chatId,
        senderUid: data.senderUid,
        content:   data.content,
        type:      (data.type as 'TEXT' | 'IMAGE') ?? 'TEXT',
        status:    (data.status as StoredMessage['status']) ?? 'SENT',
        createdAt,
        isMine:    false,
      };

      // Check if we already have this message in MMKV
      const existing = getMessages(chatId);
      const alreadySaved = existing.some(m => m.id === msgId);
      if (alreadySaved) return;

      // Save to MMKV
      appendMessage(msg);

      // Increment unread only if user is NOT currently in this chat
      if (getActiveChatId() !== chatId) {
        incrementUnread(chatId);
      }

      // Auto-mark DELIVERED (tells sender their message arrived)
      markMessageDelivered(chatId, msgId);
    });
  });

  registry.set(chatId, unsub);
}
