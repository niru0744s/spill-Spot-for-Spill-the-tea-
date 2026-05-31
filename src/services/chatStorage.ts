/**
 * services/chatStorage.ts
 * ------------------------
 * MMKV-backed local message store.
 *
 * Keys used:
 *   msgs_{chatId}          → StoredMessage[]  (last 200, JSON)
 *   draft_{chatId}         → string           (unsent draft text)
 *   unread_{chatId}        → number           (badge count)
 *   scroll_{chatId}        → number           (scroll offset px)
 *   chats_index            → string[]         (all known chatIds, JSON)
 *   chat_meta_{chatId}     → ChatMeta         (partner info + last message)
 *   retry_queue            → StoredMessage[]  (failed sends waiting for network)
 */

import { storage } from './mmkv';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MessageStatus = 'SENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';

export interface StoredMessage {
  id: string;           // UUID generated locally (expo-crypto)
  chatId: string;
  senderUid: string;
  content: string;
  type: 'TEXT' | 'IMAGE';
  status: MessageStatus;
  createdAt: number;    // Unix ms
  isMine: boolean;      // shortcut: senderUid === currentUser.uid
}

export interface ChatMeta {
  chatId: string;
  partnerUid: string;
  partnerName: string;
  partnerPhoto: string | null;
  partnerOnline: boolean;
  lastMessage: string;
  lastMessageAt: number;
  isBackedUp: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MAX_LOCAL_MESSAGES = 200;

function msgsKey(chatId: string)     { return `msgs_${chatId}`; }
function draftKey(chatId: string)    { return `draft_${chatId}`; }
function unreadKey(chatId: string)   { return `unread_${chatId}`; }
function scrollKey(chatId: string)   { return `scroll_${chatId}`; }
function metaKey(chatId: string)     { return `chat_meta_${chatId}`; }
const CHATS_INDEX_KEY               = 'chats_index';
const RETRY_QUEUE_KEY               = 'retry_queue';

function readJSON<T>(key: string, fallback: T): T {
  const raw = storage.getString(key);
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; }
  catch { return fallback; }
}

function writeJSON<T>(key: string, value: T): void {
  storage.set(key, JSON.stringify(value));
}

// ---------------------------------------------------------------------------
// Deterministic Chat ID
// Sorted so uid_A_uid_B === uid_B_uid_A regardless of who initiates
// ---------------------------------------------------------------------------

export function buildChatId(uidA: string, uidB: string): string {
  return [uidA, uidB].sort().join('_');
}

// ---------------------------------------------------------------------------
// Chat index — track which chats exist locally
// ---------------------------------------------------------------------------

export function registerChat(chatId: string): void {
  const index = readJSON<string[]>(CHATS_INDEX_KEY, []);
  if (!index.includes(chatId)) {
    index.push(chatId);
    writeJSON(CHATS_INDEX_KEY, index);
  }
}

export function getAllChatIds(): string[] {
  return readJSON<string[]>(CHATS_INDEX_KEY, []);
}

// ---------------------------------------------------------------------------
// Chat metadata (partner info, last message preview)
// ---------------------------------------------------------------------------

export function saveChatMeta(meta: ChatMeta): void {
  registerChat(meta.chatId);
  writeJSON(metaKey(meta.chatId), meta);
}

export function getChatMeta(chatId: string): ChatMeta | null {
  const raw = storage.getString(metaKey(chatId));
  if (!raw) return null;
  try { return JSON.parse(raw) as ChatMeta; }
  catch { return null; }
}

export function getAllChats(): ChatMeta[] {
  const ids = getAllChatIds();
  return ids
    .map(getChatMeta)
    .filter((m): m is ChatMeta => m !== null)
    .sort((a, b) => b.lastMessageAt - a.lastMessageAt);
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

/** Get all locally stored messages for a chat (chronological) */
export function getMessages(chatId: string): StoredMessage[] {
  return readJSON<StoredMessage[]>(msgsKey(chatId), []);
}

/** Append a new message. Caps at MAX_LOCAL_MESSAGES (drops oldest). */
export function appendMessage(msg: StoredMessage): void {
  const messages = getMessages(msg.chatId);

  // Deduplicate by id (guard against double-write)
  const exists = messages.findIndex(m => m.id === msg.id);
  if (exists !== -1) {
    // Update existing (e.g. status change)
    messages[exists] = { ...messages[exists], ...msg };
  } else {
    messages.push(msg);
  }

  // Cap to last MAX_LOCAL_MESSAGES
  const capped = messages.length > MAX_LOCAL_MESSAGES
    ? messages.slice(messages.length - MAX_LOCAL_MESSAGES)
    : messages;

  writeJSON(msgsKey(msg.chatId), capped);

  // Update chat meta preview
  const meta = getChatMeta(msg.chatId);
  if (meta) {
    saveChatMeta({
      ...meta,
      lastMessage: msg.content,
      lastMessageAt: msg.createdAt,
      isBackedUp: false,
    });
  }
}

/** Update the status of a specific message (SENDING → SENT → DELIVERED etc.) */
export function updateMessageStatus(
  chatId: string,
  messageId: string,
  status: MessageStatus
): void {
  const messages = getMessages(chatId);
  const idx = messages.findIndex(m => m.id === messageId);
  if (idx !== -1) {
    messages[idx].status = status;
    writeJSON(msgsKey(chatId), messages);
  }
}

/** Delete all local messages for a chat (after successful backup, optional) */
export function clearLocalMessages(chatId: string): void {
  storage.remove(msgsKey(chatId));
}

// ---------------------------------------------------------------------------
// Draft text
// ---------------------------------------------------------------------------

export function saveDraft(chatId: string, text: string): void {
  if (text.trim()) {
    storage.set(draftKey(chatId), text);
  } else {
    storage.remove(draftKey(chatId));
  }
}

export function getDraft(chatId: string): string {
  return storage.getString(draftKey(chatId)) ?? '';
}

export function clearDraft(chatId: string): void {
  storage.remove(draftKey(chatId));
}

// ---------------------------------------------------------------------------
// Unread count
// ---------------------------------------------------------------------------

export function getUnreadCount(chatId: string): number {
  return storage.getNumber(unreadKey(chatId)) ?? 0;
}

export function incrementUnread(chatId: string): void {
  const current = getUnreadCount(chatId);
  storage.set(unreadKey(chatId), current + 1);
}

export function clearUnread(chatId: string): void {
  storage.set(unreadKey(chatId), 0);
}

// ---------------------------------------------------------------------------
// Scroll position
// ---------------------------------------------------------------------------

export function saveScrollPosition(chatId: string, offset: number): void {
  storage.set(scrollKey(chatId), offset);
}

export function getScrollPosition(chatId: string): number {
  return storage.getNumber(scrollKey(chatId)) ?? 0;
}

// ---------------------------------------------------------------------------
// Retry queue — messages that failed to upload to Firestore
// ---------------------------------------------------------------------------

export function enqueueRetry(msg: StoredMessage): void {
  const queue = readJSON<StoredMessage[]>(RETRY_QUEUE_KEY, []);
  const exists = queue.findIndex(m => m.id === msg.id);
  if (exists === -1) queue.push(msg);
  writeJSON(RETRY_QUEUE_KEY, queue);
}

export function dequeueRetry(messageId: string): void {
  const queue = readJSON<StoredMessage[]>(RETRY_QUEUE_KEY, []);
  writeJSON(RETRY_QUEUE_KEY, queue.filter(m => m.id !== messageId));
}

export function getRetryQueue(): StoredMessage[] {
  return readJSON<StoredMessage[]>(RETRY_QUEUE_KEY, []);
}
