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

import { auth, db } from '@/config/firebase';
import { randomUUID } from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { Platform } from 'react-native';
import {
  appendMessage,
  dequeueRetry,
  enqueueRetry,
  getChatMeta,
  incrementUnread,
  saveChatMeta,
  updateMessageStatus,
  getMessagePreview,
  type ChatMeta,
  type StoredMessage,
} from './chatStorage';
import { storage } from './mmkv';
import { sendPushNotification } from './notificationService';
import { isUserOnline } from './presenceService';
import { deleteMediaFromSupabase, uploadMediaToSupabase } from './supabaseService';
import { deleteMediaBlob, saveMediaBlob } from './webMediaDb';

export const EDIT_DELETE_WINDOW_MS = 3 * 60 * 60 * 1000; // 3 hours

function safeRandomUUID(): string {
  try {
    return randomUUID();
  } catch {
    // Math.random fallback for non-secure web browser contexts
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

// ---------------------------------------------------------------------------
// Push token MMKV cache  (avoids one Firestore read per outgoing message)
// ---------------------------------------------------------------------------

const PUSH_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function ptKey(uid: string)   { return `push_token_${uid}`; }
function ptTsKey(uid: string) { return `push_token_ts_${uid}`; }

function getCachedPushToken(uid: string): string | null {
  const token = storage.getString(ptKey(uid));
  const ts    = storage.getNumber(ptTsKey(uid));
  if (!token || !ts) return null;
  if (Date.now() - ts > PUSH_TOKEN_TTL_MS) return null; // expired
  return token;
}

function cachePushToken(uid: string, token: string): void {
  storage.set(ptKey(uid), token);
  storage.set(ptTsKey(uid), Date.now());
}

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
  type?: 'TEXT' | 'IMAGE' | 'TRANSACTION' | 'PAYMENT_REQUEST';
  partnerMeta?: Partial<ChatMeta>;
}): Promise<StoredMessage> {
  const createdAt = Date.now();
  const id = `${createdAt}_${safeRandomUUID().substring(0, 8)}`;

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
      lastMessage: getMessagePreview(msg),
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
      lastMessage: getMessagePreview(msg),
      lastMessageAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  // Resolve partner UID from argument or local meta cache (critical for retry queue runs)
  let actualPartnerUid = partnerUid;
  if (!actualPartnerUid) {
    const meta = getChatMeta(chatId);
    if (meta) {
      actualPartnerUid = meta.partnerUid;
    }
  }

  // ✉️ Update inbox metadata documents in Firestore for both participants
  if (actualPartnerUid) {
    const senderName  = auth.currentUser?.displayName ?? 'Someone';
    const senderPhoto = auth.currentUser?.photoURL ?? null;

    let isPartnerOnline = false;
    let isPartnerOnChat = false;
    let pushToken: string | undefined = undefined;

    try {
      const partnerSnap = await getDoc(doc(db, 'users', actualPartnerUid));
      if (partnerSnap.exists()) {
        const partnerData = partnerSnap.data();
        isPartnerOnChat = partnerData.activeChatId === chatId;
        isPartnerOnline = isUserOnline(partnerData.lastSeen, !!partnerData.isOnline);
        pushToken = partnerData.pushToken;
      }
    } catch (err) {
      console.warn('[messageService] Failed to fetch partner profile for presence/push check:', err);
    }
    
    // 1. Write to partner's inbox doc
    const inboxRef = doc(db, 'users', actualPartnerUid, 'inbox', chatId);
    await setDoc(inboxRef, {
      chatId,
      partnerUid:    msg.senderUid,
      partnerName:   senderName,
      partnerPhoto:  senderPhoto,
      lastMessage:   getMessagePreview(msg),
      lastMessageAt: serverTimestamp(),
      // Only increment unread if they are NOT inside the active chat screen
      unread:        isPartnerOnChat ? 0 : increment(1),
    }, { merge: true });

    // 2. Also write to own inbox doc so our own Firestore preview is kept up to date
    const myInboxRef = doc(db, 'users', msg.senderUid, 'inbox', chatId);
    const partnerMeta = getChatMeta(chatId);
    await setDoc(myInboxRef, {
      chatId,
      partnerUid:    actualPartnerUid,
      partnerName:   partnerMeta?.partnerName ?? 'Tea Friend',
      partnerPhoto:  partnerMeta?.partnerPhoto ?? null,
      lastMessage:   getMessagePreview(msg),
      lastMessageAt: serverTimestamp(),
      unread:        0, // We sent the message, so unread remains 0
    }, { merge: true });

    // Send Push Notification if receiver has registered a token and is NOT online or on chat
    try {
      // Sync local cache token if we fetched a fresh one
      if (pushToken) {
        cachePushToken(actualPartnerUid, pushToken);
      } else {
        // Fallback to cache check if getDoc failed
        pushToken = getCachedPushToken(actualPartnerUid) ?? undefined;
      }

      const shouldPush = pushToken && !isPartnerOnline && !isPartnerOnChat;
      if (shouldPush) {
        await sendPushNotification({
          to: pushToken!,
          title: senderName,
          body: getMessagePreview(msg),
          data: {
            chatId,
            senderUid:     msg.senderUid,
            senderName:    senderName,
            partnerPhoto:  senderPhoto ?? 'null',
            partnerOnline: 'false',
          },
        });
      }
    } catch (notifErr) {
      console.warn('[messageService] Failed to deliver push notification:', notifErr);
    }
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

export async function markMessageRead(
  chatId: string,
  messageId: string
): Promise<void> {
  try {
    const msgRef = doc(db, 'chats', chatId, 'messages', messageId);
    await updateDoc(msgRef, { status: 'READ' });
    updateMessageStatus(chatId, messageId, 'READ');
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

export async function sendEditSignal(
  chatId: string,
  messageId: string,
  newContent: string,
  partnerUid: string
): Promise<void> {
  try {
    const signalId = safeRandomUUID();
    const msgRef = doc(db, 'chats', chatId, 'messages', signalId);

    // Write edit signal to Firestore
    await setDoc(msgRef, {
      id: signalId,
      senderUid: auth.currentUser?.uid ?? '',
      type: 'EDIT_SIGNAL',
      targetMessageId: messageId,
      content: newContent,
      createdAt: serverTimestamp(),
    });

    // Also write to partner's inbox doc so their background listener wakes up
    const inboxRef = doc(db, 'users', partnerUid, 'inbox', chatId);
    await setDoc(inboxRef, {
      chatId,
      lastMessage: 'Edited a message',
      lastMessageAt: serverTimestamp(),
    }, { merge: true });
  } catch (err) {
    console.warn('[messageService] Failed to send edit signal to Firestore:', err);
  }
}

export async function sendDeleteSignal(
  chatId: string,
  messageId: string,
  partnerUid: string,
  fileName?: string
): Promise<void> {
  try {
    const signalId = safeRandomUUID();
    const msgRef = doc(db, 'chats', chatId, 'messages', signalId);

    // Also delete the original message document from Firestore if it exists (so receiver won't pull it)
    await deleteDoc(doc(db, 'chats', chatId, 'messages', messageId)).catch(() => {});

    // Write delete signal to Firestore
    await setDoc(msgRef, {
      id: signalId,
      senderUid: auth.currentUser?.uid ?? '',
      type: 'DELETE_SIGNAL',
      targetMessageId: messageId,
      createdAt: serverTimestamp(),
    });

    // Also write to partner's inbox doc so their background listener wakes up
    const inboxRef = doc(db, 'users', partnerUid, 'inbox', chatId);
    await setDoc(inboxRef, {
      chatId,
      lastMessage: '🚫 Message deleted',
      lastMessageAt: serverTimestamp(),
    }, { merge: true });

    // Also write to own inbox doc so our own Firestore preview is kept up to date
    const myInboxRef = doc(db, 'users', auth.currentUser?.uid ?? '', 'inbox', chatId);
    await setDoc(myInboxRef, {
      chatId,
      lastMessage: '🚫 Message deleted',
      lastMessageAt: serverTimestamp(),
    }, { merge: true });

    // Clean up Supabase storage if it was a media file
    if (fileName) {
      const ext = fileName.split('.').pop() || '';
      const filenameInBucket = `${chatId}/${messageId}.${ext}`;
      await deleteMediaFromSupabase(filenameInBucket);
    }
  } catch (err) {
    console.warn('[messageService] Failed to send delete signal to Firestore:', err);
  }
}

export async function deleteLocalMediaFile(msg: StoredMessage): Promise<void> {
  if (!msg || msg.type === 'TEXT') return;

  if (Platform.OS === 'web') {
    try {
      await deleteMediaBlob(msg.id);
    } catch (err) {
      console.warn('[messageService] Failed to delete IndexedDB media blob:', err);
    }
  } else {
    if (msg.localUri && msg.localUri.startsWith('file://')) {
      try {
        const file = new File(msg.localUri);
        if (file.exists) {
          file.delete();
        }
      } catch (err) {
        console.warn('[messageService] Failed to delete local file:', err);
      }
    }
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
    fileName?: string | null;
    fileSize?: number | null;
    mimeType?: string | null;
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
    type: (firestoreData.type as any) ?? 'TEXT',
    status: (firestoreData.status as StoredMessage['status']) ?? 'DELIVERED',
    createdAt,
    isMine: firestoreData.senderUid === currentUserUid,
    fileName: firestoreData.fileName || undefined,
    fileSize: firestoreData.fileSize || undefined,
    mimeType: firestoreData.mimeType || undefined,
  };

  // Save to MMKV
  appendMessage(msg);

  // Increment unread only if this chat isn't currently open
  if (!msg.isMine && activeChatId !== chatId) {
    incrementUnread(chatId);
  }

  return msg;
}

export async function sendMediaMessage({chatId,senderUid,localUri,type,fileName,fileSize,mimeType,partnerMeta}: {
  chatId: string;
  senderUid: string;
  localUri: string;
  type: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE';
  fileName: string;
  fileSize: number;
  mimeType: string;
  partnerMeta?: Partial<ChatMeta>;
}): Promise<StoredMessage> {
  const ext = fileName.split('.').pop() || '';
  const createdAt = Date.now();
  const id = `${createdAt}_${safeRandomUUID().substring(0, 8)}`;
  
  const typeFolder = type.toLowerCase();
  const destDir = `${Paths.document.uri}media/${chatId}/${typeFolder}/`;
  const destUri = `${destDir}${id}.${ext}`;

  let finalLocalUri = localUri;
  if (Platform.OS === 'web') {
    try {
      const res = await fetch(localUri);
      const blob = await res.blob();
      await saveMediaBlob(id, blob, mimeType, fileName);
    } catch (err) {
      console.warn('[messageService] Failed to cache sent media to IndexedDB:', err);
    }
  } else {
    const dir = new Directory(destDir);
    dir.create({ intermediates: true, idempotent: true });
    const srcFile = new File(localUri);
    await srcFile.copy(new File(destUri));
    finalLocalUri = destUri;
  }

  // Build local message object (content = finalLocalUri)
  const msg: StoredMessage = {
    id,
    chatId,
    senderUid,
    content: finalLocalUri,
    type,
    status: 'SENDING',
    createdAt,
    isMine: true,
    localUri: finalLocalUri,
    fileName,
    fileSize,
    mimeType,
  };

  // Write to MMKV
  appendMessage(msg);

  // Ensure chat metadata exists locally
  let lastMsgText = 'Media file';
  if (type === 'IMAGE') lastMsgText = '📷 Image';
  else if (type === 'VIDEO') lastMsgText = '🎥 Video';
  else if (type === 'AUDIO') lastMsgText = '🎙️ Voice Message';
  else if (type === 'FILE') lastMsgText = `📄 ${fileName}`;

  const existing = getChatMeta(chatId);
  if (!existing && partnerMeta) {
    saveChatMeta({
      chatId,
      partnerUid: partnerMeta.partnerUid ?? '',
      partnerName: partnerMeta.partnerName ?? '',
      partnerPhoto: partnerMeta.partnerPhoto ?? null,
      partnerOnline: partnerMeta.partnerOnline ?? false,
      lastMessage: lastMsgText,
      lastMessageAt: createdAt,
      isBackedUp: false,
    });
  }

  // Trigger background upload
  const partnerUid = partnerMeta?.partnerUid;
  (async () => {
    try {
      const filenameInBucket = `${chatId}/${id}.${ext}`;
      const publicUrl = await uploadMediaToSupabase(finalLocalUri, filenameInBucket, mimeType);

      if (!publicUrl) {
        throw new Error('Supabase upload returned null URL');
      }

      // Update local message in MMKV with public url
      const sentMsg = { ...msg, content: publicUrl, status: 'SENT' as const };
      appendMessage(sentMsg);

      // Post metadata to Firestore
      const msgRef = doc(messagesRef(chatId), id);
      await setDoc(msgRef, {
        id,
        senderUid,
        content: publicUrl,
        type,
        status: 'SENT',
        createdAt: serverTimestamp(),
        fileName,
        fileSize,
        mimeType,
      });

      // Update chat-level metadata in Firestore
      await setDoc(
        chatDocRef(chatId),
        {
          lastMessage: lastMsgText,
          lastMessageAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // Handle partner inbox update & push notifications
      let actualPartnerUid = partnerUid;
      if (!actualPartnerUid) {
        const meta = getChatMeta(chatId);
        if (meta) actualPartnerUid = meta.partnerUid;
      }

      if (actualPartnerUid) {
        const senderName = auth.currentUser?.displayName ?? 'Someone';
        const senderPhoto = auth.currentUser?.photoURL ?? null;

        let isPartnerOnline = false;
        let isPartnerOnChat = false;
        let pushToken: string | undefined = undefined;

        try {
          const partnerSnap = await getDoc(doc(db, 'users', actualPartnerUid));
          if (partnerSnap.exists()) {
            const partnerData = partnerSnap.data();
            isPartnerOnChat = partnerData.activeChatId === chatId;
            isPartnerOnline = isUserOnline(partnerData.lastSeen, !!partnerData.isOnline);
            pushToken = partnerData.pushToken;
          }
        } catch (err) {
          console.warn('[messageService] Failed to fetch partner profile:', err);
        }

        const partnerInboxRef = doc(db, 'users', actualPartnerUid, 'inbox', chatId);
        await setDoc(
          partnerInboxRef,
          {
            chatId,
            partnerUid: senderUid,
            partnerName: senderName,
            partnerPhoto: senderPhoto,
            lastMessage: lastMsgText,
            lastMessageAt: serverTimestamp(),
            unreadCount: isPartnerOnChat ? 0 : increment(1),
            unread: isPartnerOnChat ? 0 : increment(1),
            isGroup: false,
          },
          { merge: true }
        );

        // 2. Also write to own inbox doc so our own Firestore preview is kept up to date
        const myInboxRef = doc(db, 'users', senderUid, 'inbox', chatId);
        const myMeta = getChatMeta(chatId);
        await setDoc(
          myInboxRef,
          {
            chatId,
            partnerUid: actualPartnerUid,
            partnerName: myMeta?.partnerName ?? 'Tea Friend',
            partnerPhoto: myMeta?.partnerPhoto ?? null,
            lastMessage: lastMsgText,
            lastMessageAt: serverTimestamp(),
            unreadCount: 0,
            unread: 0,
            isGroup: false,
          },
          { merge: true }
        );

        if (!isPartnerOnChat && pushToken) {
          sendPushNotification({
            to: pushToken,
            title: senderName,
            body: lastMsgText,
            data: { chatId, senderUid },
          }).catch(err => console.error('[messageService] Push failed:', err));
        }
      }
    } catch (err) {
      console.error('[messageService] sendMediaMessage background upload failed:', err);
      updateMessageStatus(chatId, id, 'FAILED');
    }
  })();

  return msg;
}

export async function downloadAndConsumeMediaMessage(
  chatId: string,
  message: StoredMessage
): Promise<void> {
  const { id, type, content: mediaUrl, fileName } = message;
  if (!mediaUrl || !mediaUrl.startsWith('http')) return; // already local or invalid

  if (Platform.OS === 'web') {
    try {
      const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANONKEY;
      const authenticatedUrl = mediaUrl.replace('/object/public/', '/object/authenticated/');

      const response = await fetch(authenticatedUrl, {
        headers: {
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'apikey':        supabaseAnonKey || '',
        }
      });

      if (!response.ok) {
        throw new Error(`Web media download failed with status ${response.status}`);
      }
      const blob = await response.blob();

      // Store in IndexedDB
      await saveMediaBlob(id, blob, message.mimeType || '', fileName || '');

      // Create Object URL
      const objectUrl = URL.createObjectURL(blob);

      const downloadedMsg: StoredMessage = {
        ...message,
        content: objectUrl,
        localUri: objectUrl,
      };
      appendMessage(downloadedMsg);

      // Delete from Supabase
      const ext = fileName?.split('.').pop() || '';
      const filenameInBucket = `${chatId}/${id}.${ext}`;
      await deleteMediaFromSupabase(filenameInBucket);
      return;
    } catch (error) {
      console.error(`[messageService] Web download failed for message ${id}:`, error);
      throw error;
    }
  }

  const typeFolder = type.toLowerCase();
  const destDir = `${Paths.document.uri}media/${chatId}/${typeFolder}/`;
  const ext = fileName?.split('.').pop() || '';
  const destUri = `${destDir}${id}.${ext}`;

  try {
    // Check disk space
    const freeSpace = Paths.availableDiskSpace;
    const fileSize = message.fileSize || 0;
    if (freeSpace < fileSize + 10 * 1024 * 1024) {
      throw new Error('Insufficient disk space');
    }

    const dir = new Directory(destDir);
    dir.create({ intermediates: true, idempotent: true });

    const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANONKEY;
    const authenticatedUrl = mediaUrl.replace('/object/public/', '/object/authenticated/');

    // Download natively with auth headers
    await File.downloadFileAsync(authenticatedUrl, new File(destUri), {
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'apikey':        supabaseAnonKey || '',
      },
      idempotent: true,
    });

    // Update MMKV message
    const downloadedMsg = {
      ...message,
      content: destUri,
      localUri: destUri,
    };
    appendMessage(downloadedMsg);

    // Delete temporary file from Supabase
    const filenameInBucket = `${chatId}/${id}.${ext}`;
    await deleteMediaFromSupabase(filenameInBucket);

  } catch (error) {
    console.error(`[messageService] Failed to download media for message ${id}:`, error);
    throw error;
  }
}
