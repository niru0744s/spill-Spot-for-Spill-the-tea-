/**
 * services/backupService.ts
 * --------------------------
 * Manual cloud backup — uploads all local MMKV messages to Firestore.
 *
 * Flow:
 *   1. Get all locally stored messages for all chats
 *   2. Batch-upload to Firestore in chunks of 500 (Firestore limit)
 *   3. Mark chat meta as backed up
 *   4. Update /users/{uid}/chatsBackedUpAt on completion
 *
 * Usage:
 *   const { backupAll, isBackingUp, progress } = useBackup();
 */

import {
  writeBatch,
  doc,
  serverTimestamp,
  setDoc,
  collection,
} from 'firebase/firestore';
import { db, auth } from '@/config/firebase';
import {
  getAllChatIds,
  getMessages,
  getChatMeta,
  saveChatMeta,
} from './chatStorage';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BackupProgress {
  total: number;
  uploaded: number;
  done: boolean;
  error: string | null;
}

type ProgressCallback = (progress: BackupProgress) => void;

// ---------------------------------------------------------------------------
// Backup all chats
// ---------------------------------------------------------------------------

export async function backupAllChats(
  onProgress?: ProgressCallback
): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not authenticated');

  const chatIds = getAllChatIds();

  // Count total messages to upload
  let total = 0;
  const allMsgs: Array<{ chatId: string; msgs: ReturnType<typeof getMessages> }> = [];

  for (const chatId of chatIds) {
    const msgs = getMessages(chatId);
    allMsgs.push({ chatId, msgs });
    total += msgs.length;
  }

  if (total === 0) {
    onProgress?.({ total: 0, uploaded: 0, done: true, error: null });
    return;
  }

  let uploaded = 0;

  // Process each chat
  for (const { chatId, msgs } of allMsgs) {
    if (msgs.length === 0) continue;

    // Ensure chat document exists in Firestore
    const meta = getChatMeta(chatId);
    if (meta) {
      await setDoc(
        doc(db, 'chats', chatId),
        {
          participants: [uid, meta.partnerUid],
          lastMessage: meta.lastMessage,
          lastMessageAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );
    }

    // Batch upload messages in chunks of 500
    const CHUNK_SIZE = 500;
    for (let i = 0; i < msgs.length; i += CHUNK_SIZE) {
      const chunk = msgs.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);

      for (const msg of chunk) {
        const msgRef = doc(
          collection(db, 'chats', chatId, 'messages'),
          msg.id
        );
        batch.set(msgRef, {
          id: msg.id,
          senderUid: msg.senderUid,
          content: msg.content,
          type: msg.type,
          status: msg.status,
          createdAt: msg.createdAt,
        }, { merge: true });
      }

      await batch.commit();

      uploaded += chunk.length;
      onProgress?.({ total, uploaded, done: false, error: null });
    }

    // Mark chat as backed up locally
    if (meta) {
      saveChatMeta({ ...meta, isBackedUp: true });
    }
  }

  // Update user's last backup timestamp in Firestore
  await setDoc(
    doc(db, 'users', uid),
    { chatsBackedUpAt: serverTimestamp() },
    { merge: true }
  );

  onProgress?.({ total, uploaded, done: true, error: null });
}
