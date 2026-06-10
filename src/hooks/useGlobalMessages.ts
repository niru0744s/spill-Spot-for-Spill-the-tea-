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
  getChatMeta,
  type StoredMessage,
} from '@/services/chatStorage';
import { router } from 'expo-router';
import { useBannerStore } from '@/store/bannerStore';
import { getActiveChatId } from '@/services/activeChat';
import { markMessageDelivered } from '@/services/messageService';

import { useAuth } from '@/hooks/useAuth';

export function useGlobalMessages() {
  const { firebaseUser } = useAuth();
  const currentUid = firebaseUser?.uid ?? '';
  // Maximum number of background per-chat listeners to keep open at once.
  // For users with many chats this prevents unbounded listener growth.
  const MAX_CHAT_LISTENERS = 20;
  // Track per-chat message listeners so we don't double-attach
  const chatUnsubsRef = useRef<Map<string, Unsubscribe>>(new Map());
  // Tracks insertion order (oldest first) for LRU pruning
  const chatOrderRef  = useRef<string[]>([]);

  useEffect(() => {
    if (!currentUid) return;

    // ── Watch the user's inbox for new/updated chats ──────────────────────
    const inboxRef = collection(db, 'users', currentUid, 'inbox');
    const inboxQuery = query(inboxRef, orderBy('lastMessageAt', 'desc'));

    const unsubInbox = onSnapshot(inboxQuery, (snapshot) => {
      for (const change of snapshot.docChanges()) {
        if (change.type !== 'added' && change.type !== 'modified') continue;

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
          isGroup:       data.isGroup      ?? false,
          status:        data.status       ?? 'ACTIVE',
        });

        // 2️⃣ Attach a messages listener for this chat (if not already attached)
        if (!chatUnsubsRef.current.has(chatId)) {
          // Prune the oldest listener if we've hit the cap
          if (chatUnsubsRef.current.size >= MAX_CHAT_LISTENERS) {
            const oldest = chatOrderRef.current.shift();
            if (oldest) {
              chatUnsubsRef.current.get(oldest)?.();
              chatUnsubsRef.current.delete(oldest);
            }
          }
          attachChatListener(chatId, currentUid, chatUnsubsRef.current, chatOrderRef.current);
        }
      }
    });

    return () => {
      unsubInbox();
      // Detach all per-chat listeners on unmount
      chatUnsubsRef.current.forEach(unsub => unsub());
      chatUnsubsRef.current.clear();
      chatOrderRef.current = [];
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
  registry: Map<string, Unsubscribe>,
  order: string[]
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

      // Increment unread and trigger In-App Banner only if user is NOT currently in this chat
      if (getActiveChatId() !== chatId) {
        incrementUnread(chatId);

        // Retrieve partner info from local chat metadata cache
        const meta = getChatMeta(chatId);
        const partnerName = meta?.partnerName ?? 'Tea Friend';
        const partnerPhoto = meta?.partnerPhoto ?? null;

        // Trigger sliding In-App Banner alert overlay
        useBannerStore.getState().showBanner(
          partnerName,
          msg.content,
          partnerPhoto,
          () => {
            router.push({
              pathname: '/chat/[id]',
              params: {
                id: msg.senderUid,
                username: partnerName,
                photoURL: partnerPhoto ?? 'null',
                isOnline: 'true',
              },
            });
          }
        );
      }

      // Auto-mark DELIVERED (tells sender their message arrived)
      markMessageDelivered(chatId, msgId);
    });
  });

  registry.set(chatId, unsub);
  order.push(chatId); // record insertion order for LRU pruning
}
