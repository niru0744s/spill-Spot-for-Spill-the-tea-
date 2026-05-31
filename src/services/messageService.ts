/**
 * services/messageService.ts
 * ---------------------------
 * Handles sending messages:
 *   1. Write to MMKV immediately (optimistic UI)
 *   2. Upload to Firestore async
 *   3. On success → update status to SENT
 *   4. On failure → enqueue for retry
 *
 * Also handles incoming messages from Firestore onSnapshot:
 *   - Writes to MMKV
 *   - Updates unread count
 */

import {
  collection,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
  query,
  where,
  getDocs,
  writeBatch,
  increment,
} from 'firebase/firestore';
import { randomUUID } from 'expo-crypto';
import { db, auth } from '@/config/firebase';
import {
  appendMessage,
  updateMessageStatus,
  enqueueRetry,
  dequeueRetry,
  incrementUnread,
  saveChatMeta,
  getChatMeta,
  type StoredMessage,
  type ChatMeta,
} from './chatStorage';

// ---------------------------------------------------------------------------
// Firestore path helper
// /chats/{chatId}/messages/{messageId}
// ---------------------------------------------------------------------------

function messagesRef(chatId: string) {
  return collection(db, 'chats', chatId, 'messages');
}

function chatDocRef(chatId: string) {
  return doc(db, 'chats', chatId);
}

// ---------------------------------------------------------------------------
// Send a message
// ---------------------------------------------------------------------------

export async function sendMessage({
  chatId,
  senderUid,
  content,
  type = 'TEXT',
  partnerMeta,
}: {
  chatId: string;
  senderUid: string;
  content: string;
  type?: 'TEXT' | 'IMAGE';
  partnerMeta?: Partial<ChatMeta>;
}): Promise<StoredMessage> {
  const id = randomUUID();
  const createdAt = Date.now();

  // 1️⃣ Build the message object
  const msg: StoredMessage = {
    id,
    chatId,
    senderUid,
    content,
    type,
    status: 'SENDING',
    createdAt,
    isMine: true,
  };

  // 2️⃣ Write to MMKV immediately — UI updates instantly
  appendMessage(msg);

  // 3️⃣ Ensure chat metadata exists locally
  const existing = getChatMeta(chatId);
  if (!existing && partnerMeta) {
    saveChatMeta({
      chatId,
      partnerUid: partnerMeta.partnerUid ?? '',
      partnerName: partnerMeta.partnerName ?? '',
      partnerPhoto: partnerMeta.partnerPhoto ?? null,
      partnerOnline: partnerMeta.partnerOnline ?? false,
      lastMessage: content,
      lastMessageAt: createdAt,
      isBackedUp: false,
    });
  }

  // 4️⃣ Upload to Firestore async (do not await — non-blocking)
  const partnerUid = partnerMeta?.partnerUid;
  uploadToFirestore(chatId, msg, partnerUid).catch(() => {
    // Network failure: mark failed + enqueue retry
    updateMessageStatus(chatId, id, 'FAILED');
    enqueueRetry(msg);
  });

  return msg;
}

// ---------------------------------------------------------------------------
// Upload a single message to Firestore
// ---------------------------------------------------------------------------

async function uploadToFirestore(chatId: string, msg: StoredMessage, partnerUid?: string): Promise<void> {
  const msgRef = doc(messagesRef(chatId), msg.id);

  await setDoc(msgRef, {
    id: msg.id,
    senderUid: msg.senderUid,
    content: msg.content,
    type: msg.type,
    status: 'SENT',
    createdAt: serverTimestamp(),
  });

  // Update chat-level metadata in Firestore
  await setDoc(
    chatDocRef(chatId),
    {
      lastMessage: msg.content,
      lastMessageAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  // ✉️ Write to partner's inbox so their global listener can pick it up
  if (partnerUid) {
    const senderName  = auth.currentUser?.displayName ?? 'Someone';
    const senderPhoto = auth.currentUser?.photoURL ?? null;
    const inboxRef = doc(db, 'users', partnerUid, 'inbox', chatId);
    await setDoc(inboxRef, {
      chatId,
      partnerUid:    msg.senderUid,
      partnerName:   senderName,
      partnerPhoto:  senderPhoto,
      lastMessage:   msg.content,
      lastMessageAt: serverTimestamp(),
      unread:        increment(1),
    }, { merge: true });
  }

  // Update local status to SENT
  updateMessageStatus(chatId, msg.id, 'SENT');
}

// ---------------------------------------------------------------------------
// Mark a single incoming message as DELIVERED in Firestore
// Called the moment the receiver's onSnapshot fires for a new message
// ---------------------------------------------------------------------------

export async function markMessageDelivered(
  chatId: string,
  messageId: string
): Promise<void> {
  try {
    const msgRef = doc(db, 'chats', chatId, 'messages', messageId);
    await updateDoc(msgRef, { status: 'DELIVERED' });
    updateMessageStatus(chatId, messageId, 'DELIVERED');
  } catch {
    // Non-critical — ignore failures
  }
}

// ---------------------------------------------------------------------------
// Mark all partner messages in a chat as READ in Firestore
// Called when the receiver opens (or re-focuses) the chat screen
// ---------------------------------------------------------------------------

export async function markMessagesAsRead(
  chatId: string,
  currentUid: string
): Promise<void> {
  try {
    const msgsRef = collection(db, 'chats', chatId, 'messages');
    // Only fetch messages sent by the OTHER user that aren't READ yet
    const q = query(
      msgsRef,
      where('senderUid', '!=', currentUid),
      where('status', 'in', ['SENT', 'DELIVERED'])
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return;

    const batch = writeBatch(db);
    snapshot.docs.forEach(d => {
      batch.update(d.ref, { status: 'READ' });
    });
    await batch.commit();

    // Update local MMKV too
    snapshot.docs.forEach(d => {
      updateMessageStatus(chatId, d.id, 'READ');
    });
  } catch {
    // Non-critical
  }
}

export async function processRetryQueue(chatId: string): Promise<void> {
  const { getRetryQueue } = await import('./chatStorage');
  const queue = getRetryQueue().filter(m => m.chatId === chatId);

  for (const msg of queue) {
    try {
      await uploadToFirestore(chatId, msg);
      dequeueRetry(msg.id);
      updateMessageStatus(chatId, msg.id, 'SENT');
    } catch {
      // Still failing — leave in queue
    }
  }
}

// ---------------------------------------------------------------------------
// Handle incoming message from Firestore onSnapshot
// (called from useRealtimeChat hook)
// ---------------------------------------------------------------------------

export function handleIncomingMessage({
  chatId,
  currentUserUid,
  firestoreData,
  activeChatId,
}: {
  chatId: string;
  currentUserUid: string;
  firestoreData: {
    id: string;
    senderUid: string;
    content: string;
    type: string;
    status: string;
    createdAt: Timestamp | null;
  };
  activeChatId: string | null; // currently open chat (null if on other screen)
}): StoredMessage {
  const createdAt = firestoreData.createdAt
    ? firestoreData.createdAt.toMillis()
    : Date.now();

  const msg: StoredMessage = {
    id: firestoreData.id,
    chatId,
    senderUid: firestoreData.senderUid,
    content: firestoreData.content,
    type: (firestoreData.type as 'TEXT' | 'IMAGE') ?? 'TEXT',
    status: (firestoreData.status as StoredMessage['status']) ?? 'DELIVERED',
    createdAt,
    isMine: firestoreData.senderUid === currentUserUid,
  };

  // Save to MMKV
  appendMessage(msg);

  // Increment unread only if this chat isn't currently open
  if (!msg.isMine && activeChatId !== chatId) {
    incrementUnread(chatId);
  }

  return msg;
}
