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
import { Platform } from 'react-native';
import { getMediaBlob } from '@/services/webMediaDb';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import NetInfo from '@react-native-community/netinfo';
import { db, auth } from '@/config/firebase';
import {
  handleIncomingMessage,
  processRetryQueue,
  markMessagesAsRead,
  EDIT_DELETE_WINDOW_MS,
  downloadAndConsumeMediaMessage,
  deleteLocalMediaFile,
} from '@/services/messageService';
import { triggerMediumImpact } from '@/services/hapticService';
import { getMessages, updateMessageStatus, getChatMeta, saveChatMeta, clearUnread, editMessageLocally, deleteMessageLocally, markMessageAsDeletedLocally, getMessagePreview, type StoredMessage } from '@/services/chatStorage';

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

  const editLocalMessageState = useCallback((messageId: string, content: string) => {
    setMessages(prev =>
      prev.map(m => m.id === messageId ? { ...m, content } : m)
    );
  }, []);

  const deleteLocalMessageState = useCallback((messageId: string) => {
    setMessages(prev => prev.filter(m => m.id !== messageId));
  }, []);

  const markLocalMessageAsDeletedState = useCallback((messageId: string) => {
    setMessages(prev =>
      prev.map(m =>
        m.id === messageId
          ? {
              ...m,
              type: 'DELETED',
              content: 'Message deleted',
              localUri: undefined,
              fileName: undefined,
              fileSize: undefined,
              mimeType: undefined,
            }
          : m
      )
    );
  }, []);

  // ── Web Media Hydration (IndexedDB Blobs → Object URLs) ──────────────────
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    let active = true;
    async function hydrateWebMedia() {
      const mediaMessages = messages.filter(m => m.type !== 'TEXT' && m.localUri);
      if (mediaMessages.length === 0) return;

      let updated = false;
      const hydratedMessages = await Promise.all(
        messages.map(async (msg) => {
          if (msg.type !== 'TEXT' && msg.id) {
            const record = await getMediaBlob(msg.id);
            if (record && record.blob) {
              const objectUrl = URL.createObjectURL(record.blob);
              updated = true;
              return {
                ...msg,
                localUri: objectUrl,
                content: msg.content.startsWith('blob:') ? objectUrl : msg.content,
              };
            }
          }
          return msg;
        })
      );

      if (active && updated) {
        setMessages(hydratedMessages);
      }
    }

    hydrateWebMedia();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  // ── Mount-time Undownloaded Media Check ──────────────────────────────────
  useEffect(() => {
    const undownloaded = messages.filter(
      m => m.type !== 'TEXT' && m.content?.startsWith('http') && !m.localUri
    );

    if (undownloaded.length === 0) return;

    undownloaded.forEach((msg) => {
      downloadAndConsumeMediaMessage(chatId, msg).then(() => {
        setMessages(prev =>
          prev.map(m => {
            if (m.id === msg.id) {
              const fresh = getMessages(chatId).find(x => x.id === msg.id);
              return fresh ? fresh : m;
            }
            return m;
          })
        );
      }).catch((err) => {
        console.error('[useRealtimeChat] Mount-time download failed:', err);
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

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

            // Sync the chat metadata preview in MMKV if this is the newest message
            const meta = getChatMeta(chatId);
            const msgCreatedAt = data.createdAt instanceof Timestamp
              ? data.createdAt.toMillis()
              : Date.now();
            if (meta && msgCreatedAt >= (meta.lastMessageAt ?? 0)) {
              const tempMsg: StoredMessage = {
                id: msgId,
                chatId,
                senderUid: data.senderUid,
                content: data.content ?? '',
                type: data.type ?? 'TEXT',
                status: data.status ?? 'SENT',
                createdAt: msgCreatedAt,
                isMine: true,
                fileName: data.fileName ?? undefined,
                fileSize: data.fileSize ?? undefined,
                mimeType: data.mimeType ?? undefined,
              };
              saveChatMeta({
                ...meta,
                lastMessage: getMessagePreview(tempMsg),
                lastMessageAt: msgCreatedAt,
                isBackedUp: false,
              });
            }
            return;
          }

          // Handle Control Signals
          if (data.type === 'DELETE_SIGNAL') {
            const localMsgs = getMessages(chatId);
            const target = localMsgs.find(m => m.id === data.targetMessageId);
            
            if (target) {
              if (target.type !== 'TEXT') {
                deleteLocalMediaFile(target).catch(() => {});
              }
              markMessageAsDeletedLocally(chatId, data.targetMessageId);
              markLocalMessageAsDeletedState(data.targetMessageId);
            }
            deleteDoc(doc(db, 'chats', chatId, 'messages', msgId)).catch(() => {});
            return;
          }

          if (data.type === 'EDIT_SIGNAL') {
            const localMsgs = getMessages(chatId);
            const target = localMsgs.find(m => m.id === data.targetMessageId);

            if (target) {
              editMessageLocally(chatId, data.targetMessageId, data.content);
              setMessages(prev =>
                prev.map(m => m.id === data.targetMessageId ? { ...m, content: data.content } : m)
              );
            }
            deleteDoc(doc(db, 'chats', chatId, 'messages', msgId)).catch(() => {});
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
              fileName: data.fileName ?? null,
              fileSize: data.fileSize ?? null,
              mimeType: data.mimeType ?? null,
            } as any,
            activeChatId: chatId,
          });

          setMessages(prev => {
            const exists = prev.findIndex(m => m.id === incoming.id);
            if (exists !== -1) return prev;
            triggerMediumImpact();
            return [...prev, incoming];
          });

          // Trigger background download and consumption of transit media
          if (incoming.type !== 'TEXT') {
            downloadAndConsumeMediaMessage(chatId, incoming).then(() => {
              setMessages(prev =>
                prev.map(m => {
                  if (m.id === incoming.id) {
                    const fresh = getMessages(chatId).find(x => x.id === incoming.id);
                    return fresh ? fresh : m;
                  }
                  return m;
                })
              );
            }).catch((err) => {
              console.error('[useRealtimeChat] downloadAndConsumeMediaMessage error:', err);
            });
          }

          // Delete the transit message from Firestore immediately after receipt
          deleteDoc(doc(db, 'chats', chatId, 'messages', msgId)).catch(() => {});
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
  }, [chatId, currentUid, updateLocalStatus, markLocalMessageAsDeletedState]);

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
    clearUnread(chatId);
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
    editLocalMessageState,
    deleteLocalMessageState,
    markLocalMessageAsDeletedState,
    markAsRead,
    notifyTyping,
    stopTyping,
  };
}
