import { useEffect, useRef, useCallback, useState } from 'react';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  setDoc,
  serverTimestamp,
  Timestamp,
  getDoc,
  increment,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import NetInfo from '@react-native-community/netinfo';

import { db, auth } from '@/config/firebase';
import { getMessages, appendMessage, updateMessageStatus, type StoredMessage } from '@/services/chatStorage';
import { sendPushNotification } from '@/services/notificationService';
import { randomUUID } from 'expo-crypto';

function safeRandomUUID(): string {
  try {
    return randomUUID();
  } catch {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

export function useGroupChat(groupId: string) {
  const currentUid = auth.currentUser?.uid ?? '';
  const currentName = auth.currentUser?.displayName ?? 'Someone';
  const currentPhoto = auth.currentUser?.photoURL ?? null;

  const [messages, setMessages] = useState<StoredMessage[]>(() => getMessages(groupId));
  const [isOnline, setIsOnline] = useState(true);

  const unsubMsgsRef = useRef<Unsubscribe | null>(null);

  // ── Helper: update message status in local state ─────────────────────────
  const updateLocalStatus = useCallback((messageId: string, status: StoredMessage['status']) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, status } : m))
    );
  }, []);

  // ── 1. Listen to Firestore messages ──────────────────────────────────────
  useEffect(() => {
    if (!groupId || !currentUid) return;

    const msgsRef = collection(db, 'chats', groupId, 'messages');
    const q = query(msgsRef, orderBy('createdAt', 'asc'));

    unsubMsgsRef.current = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const data = change.doc.data();
        const msgId = change.doc.id;

        if (change.type === 'added') {
          // If it's a message sent by the current user, it was already added optimistically.
          // We just sync the status confirmed by Firestore.
          if (data.senderUid === currentUid) {
            updateLocalStatus(msgId, 'SENT');
            updateMessageStatus(groupId, msgId, 'SENT');
            return;
          }

          // Build the incoming group message
          const incoming: StoredMessage = {
            id: msgId,
            chatId: groupId,
            senderUid: data.senderUid,
            senderName: data.senderName ?? 'Tea Friend',
            senderPhoto: data.senderPhoto ?? null,
            content: data.content ?? '',
            type: (data.type as 'TEXT' | 'IMAGE') ?? 'TEXT',
            status: 'DELIVERED',
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : Date.now(),
            isMine: false,
          };

          // Save to MMKV cache
          appendMessage(incoming);

          // Update local state
          setMessages((prev) => {
            if (prev.some((m) => m.id === incoming.id)) return prev;
            return [...prev, incoming];
          });
        }

        if (change.type === 'modified') {
          const newStatus = (data.status ?? 'SENT') as StoredMessage['status'];
          updateLocalStatus(msgId, newStatus);
          updateMessageStatus(groupId, msgId, newStatus);
        }
      });
    });

    return () => unsubMsgsRef.current?.();
  }, [groupId, currentUid, updateLocalStatus]);

  // ── 2. Network offline retry sync ────────────────────────────────────────
  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected ?? false);
    });
    return () => unsub();
  }, []);

  // ── 3. Trigger Group Push Notifications ──────────────────────────────────
  const triggerGroupPushNotifications = useCallback(async (content: string) => {
    try {
      // Fetch group details and active members from Firestore
      const groupSnap = await getDoc(doc(db, 'chats', groupId));
      if (!groupSnap.exists()) return;
      
      const groupData = groupSnap.data();
      const groupName = groupData?.groupName ?? 'Tea Circle 🫖';
      const members = groupData?.members ?? {};

      // Find all active members (except current sender)
      const activeRecipientUids = Object.keys(members).filter(
        (uid) => uid !== currentUid && members[uid].status === 'ACTIVE'
      );

      for (const uid of activeRecipientUids) {
        try {
          // Fetch push token from Firestore /users/{uid}
          const userSnap = await getDoc(doc(db, 'users', uid));
          if (userSnap.exists()) {
            const pushToken = userSnap.data()?.pushToken as string | undefined;
            if (pushToken) {
              await sendPushNotification({
                to: pushToken,
                title: `${currentName} in ${groupName}`,
                body: content,
                data: {
                  chatId: groupId,
                  isGroup: 'true',
                  groupName,
                },
              });
            }
          }
        } catch (e) {
          console.warn(`[useGroupChat] Failed push to member ${uid}:`, e);
        }
      }
    } catch (err) {
      console.warn('[useGroupChat] Failed to dispatch group notifications:', err);
    }
  }, [groupId, currentUid, currentName]);

  // ── 4. Send Group Message ────────────────────────────────────────────────
  const sendGroupMessage = useCallback(
    async (content: string, type: 'TEXT' | 'IMAGE' = 'TEXT'): Promise<boolean> => {
      if (!currentUid || !groupId) return false;

      const messageId = safeRandomUUID();
      const createdAt = Date.now();

      // Create local optimistic message
      const msg: StoredMessage = {
        id: messageId,
        chatId: groupId,
        senderUid: currentUid,
        senderName: currentName,
        senderPhoto: currentPhoto,
        content,
        type,
        status: 'SENDING',
        createdAt,
        isMine: true,
      };

      // 1. Save to MMKV and update local React state instantly
      appendMessage(msg);
      setMessages((prev) => [...prev, msg]);

      // 2. Upload to Firestore
      try {
        const msgRef = doc(db, 'chats', groupId, 'messages', messageId);
        await setDoc(msgRef, {
          id: messageId,
          senderUid: currentUid,
          senderName: currentName,
          senderPhoto: currentPhoto,
          content,
          type,
          status: 'SENT',
          createdAt: serverTimestamp(),
        });

        // 3. Update group metadata and propagate to inboxes in Firestore
        const groupRef = doc(db, 'chats', groupId);
        const groupSnap = await getDoc(groupRef);
        if (groupSnap.exists()) {
          const groupData = groupSnap.data();
          const groupName = groupData?.groupName ?? 'Tea Circle 🫖';
          const groupImageUrl = groupData?.groupImageUrl ?? null;
          const members = groupData?.members ?? {};

          await setDoc(groupRef, {
            lastMessage: content,
            lastMessageAt: serverTimestamp(),
          }, { merge: true });

          const batch = writeBatch(db);
          const activeMemberUids = Object.keys(members).filter(
            (uid) => members[uid].status === 'ACTIVE'
          );

          for (const memberUid of activeMemberUids) {
            const inboxRef = doc(db, 'users', memberUid, 'inbox', groupId);
            batch.set(inboxRef, {
              chatId: groupId,
              isGroup: true,
              partnerUid: 'GROUP',
              partnerName: groupName,
              partnerPhoto: groupImageUrl,
              lastMessage: content,
              lastMessageAt: serverTimestamp(),
              unread: memberUid === currentUid ? 0 : increment(1),
              status: 'ACTIVE',
            }, { merge: true });
          }
          await batch.commit();
        }

        updateLocalStatus(messageId, 'SENT');
        updateMessageStatus(groupId, messageId, 'SENT');

        // 4. Send Push Notifications in background (non-blocking)
        triggerGroupPushNotifications(content).catch((err) =>
          console.warn('[useGroupChat] Failed to send push notifications:', err)
        );

        return true;
      } catch (err) {
        console.error('[useGroupChat] Error uploading message:', err);
        updateLocalStatus(messageId, 'FAILED');
        updateMessageStatus(groupId, messageId, 'FAILED');
        return false;
      }
    },
    [groupId, currentUid, currentName, currentPhoto, updateLocalStatus, triggerGroupPushNotifications]
  );

  return {
    messages,
    isOnline,
    sendGroupMessage,
  };
}
