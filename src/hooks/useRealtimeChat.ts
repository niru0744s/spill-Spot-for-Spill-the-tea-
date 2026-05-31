/**
 * hooks/useRealtimeChat.ts
 * -------------------------
 * Attaches a Firestore onSnapshot listener to /chats/{chatId}/messages
 *
 * Handles:
 *   ADDED   — new incoming message → save to MMKV → mark DELIVERED in Firestore
 *   MODIFIED — status change (SENT→DELIVERED→READ) → update local state + MMKV
 *
 * Also:
 *   - Typing indicator (ephemeral Firestore docs, 3s TTL)
 *   - NetInfo retry queue processor
 *   - markAsRead() — call on chat open/focus to flip all to READ
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import NetInfo from '@react-native-community/netinfo';
import { db, auth } from '@/config/firebase';
import {
  handleIncomingMessage,
  processRetryQueue,
  markMessageDelivered,
  markMessagesAsRead,
} from '@/services/messageService';
import { getMessages, updateMessageStatus, type StoredMessage } from '@/services/chatStorage';

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useRealtimeChat(chatId: string) {
  const currentUid = auth.currentUser?.uid ?? '';

  // Local message state — seeded from MMKV, updated by listener
  const [messages, setMessages] = useState<StoredMessage[]>(() =>
    getMessages(chatId)
  );
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [isOnline, setIsOnline]           = useState(true);

  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unsubMsgsRef   = useRef<Unsubscribe | null>(null);
  const unsubTypingRef = useRef<Unsubscribe | null>(null);

  // ── Helper: update one message's status in local React state ─────────────
  const updateLocalStatus = useCallback((
    messageId: string,
    status: StoredMessage['status']
  ) => {
    setMessages(prev =>
      prev.map(m => m.id === messageId ? { ...m, status } : m)
    );
  }, []);

  // ── 1. Message listener ──────────────────────────────────────────────────
  useEffect(() => {
    if (!chatId || !currentUid) return;

    const msgsRef = collection(db, 'chats', chatId, 'messages');
    const q = query(msgsRef, orderBy('createdAt', 'asc'));

    unsubMsgsRef.current = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {

        const data = change.doc.data();
        const msgId = change.doc.id;

        // ── ADDED: new message arrived ─────────────────────────────────────
        if (change.type === 'added') {

          // Own messages are already saved optimistically — but watch for
          // status updates that piggy-back on the initial write
          if (data.senderUid === currentUid) {
            // Sync our optimistic status with what Firestore confirmed
            updateLocalStatus(msgId, data.status ?? 'SENT');
            updateMessageStatus(chatId, msgId, data.status ?? 'SENT');
            return;
          }

          // Incoming message from partner
          const incoming = handleIncomingMessage({
            chatId,
            currentUserUid: currentUid,
            firestoreData: {
              id: msgId,
              senderUid: data.senderUid,
              content: data.content,
              type: data.type ?? 'TEXT',
              status: data.status ?? 'SENT',
              createdAt: data.createdAt ?? null,
            },
            activeChatId: chatId,
          });

          setMessages(prev => {
            const exists = prev.findIndex(m => m.id === incoming.id);
            if (exists !== -1) return prev;
            return [...prev, incoming];
          });

          // Auto-mark as DELIVERED — lets sender see ✓✓ immediately
          markMessageDelivered(chatId, msgId);
        }

        // ── MODIFIED: status changed (SENT→DELIVERED→READ) ─────────────────
        if (change.type === 'modified') {
          const newStatus = (data.status ?? 'SENT') as StoredMessage['status'];

          // Update our own outgoing message ticks (SENT→DELIVERED→READ)
          if (data.senderUid === currentUid) {
            updateLocalStatus(msgId, newStatus);
            updateMessageStatus(chatId, msgId, newStatus);
          } else {
            // Incoming message status changed (e.g., we marked it READ)
            updateLocalStatus(msgId, newStatus);
            updateMessageStatus(chatId, msgId, newStatus);
          }
        }
      });
    });

    return () => { unsubMsgsRef.current?.(); };
  }, [chatId, currentUid, updateLocalStatus]);

  // ── 2. Typing indicator listener ─────────────────────────────────────────
  useEffect(() => {
    if (!chatId || !currentUid) return;

    const typingRef = collection(db, 'chats', chatId, 'typing');
    unsubTypingRef.current = onSnapshot(typingRef, (snapshot) => {
      const otherTyping = snapshot.docs.some(d => d.id !== currentUid);
      setIsOtherTyping(otherTyping);
    });

    return () => { unsubTypingRef.current?.(); };
  }, [chatId, currentUid]);

  // ── 3. NetInfo — process retry queue when back online ───────────────────
  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      const online = state.isConnected ?? false;
      setIsOnline(online);
      if (online) processRetryQueue(chatId).catch(() => {});
    });
    return () => unsub();
  }, [chatId]);

  // ── 4. Append a locally sent message to state ────────────────────────────
  const appendLocalMessage = useCallback((msg: StoredMessage) => {
    setMessages(prev => {
      const exists = prev.findIndex(m => m.id === msg.id);
      if (exists !== -1) {
        const updated = [...prev];
        updated[exists] = { ...updated[exists], ...msg };
        return updated;
      }
      return [...prev, msg];
    });
  }, []);

  // ── 5. Mark all partner messages as READ (call on chat open/focus) ───────
  const markAsRead = useCallback(() => {
    if (!currentUid) return;
    markMessagesAsRead(chatId, currentUid).catch(() => {});
  }, [chatId, currentUid]);

  // ── 6. Typing indicator ──────────────────────────────────────────────────
  const notifyTyping = useCallback(async () => {
    if (!currentUid) return;
    const typingDoc = doc(db, 'chats', chatId, 'typing', currentUid);
    try {
      await setDoc(typingDoc, { typingAt: serverTimestamp() });
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(async () => {
        try { await deleteDoc(typingDoc); } catch {}
      }, 3000);
    } catch {}
  }, [chatId, currentUid]);

  const stopTyping = useCallback(async () => {
    if (!currentUid) return;
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    const typingDoc = doc(db, 'chats', chatId, 'typing', currentUid);
    try { await deleteDoc(typingDoc); } catch {}
  }, [chatId, currentUid]);

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      stopTyping();
    };
  }, [stopTyping]);

  return {
    messages,
    isOtherTyping,
    isOnline,
    appendLocalMessage,
    updateLocalStatus,
    markAsRead,
    notifyTyping,
    stopTyping,
  };
}
