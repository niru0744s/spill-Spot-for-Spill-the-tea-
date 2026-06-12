/**
 * services/webMediaDb.ts
 * ----------------------
 * Persistent browser storage for binary media files using IndexedDB.
 * Safe for cross-platform use (fully guarded on native iOS/Android).
 */
import { Platform } from 'react-native';

const DB_NAME = 'spill_media_db';
const DB_VERSION = 1;
const STORE_NAME = 'media';

export interface WebMediaRecord {
  messageId: string;
  blob: Blob;
  mimeType: string;
  fileName: string;
  createdAt: number;
}

const isWeb = Platform.OS === 'web' && typeof indexedDB !== 'undefined';

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase | null> {
  if (!isWeb) return Promise.resolve(null);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'messageId' });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });

  return dbPromise;
}

export async function saveMediaBlob(
  messageId: string,
  blob: Blob,
  mimeType: string,
  fileName: string
): Promise<void> {
  if (!isWeb) return;

  try {
    const db = await getDB();
    if (!db) return;

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const record: WebMediaRecord = {
        messageId,
        blob,
        mimeType,
        fileName,
        createdAt: Date.now(),
      };
      const request = store.put(record);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[webMediaDb] Save error:', error);
  }
}

export async function getMediaBlob(
  messageId: string
): Promise<WebMediaRecord | null> {
  if (!isWeb) return null;

  try {
    const db = await getDB();
    if (!db) return null;

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(messageId);

      request.onsuccess = () => {
        resolve(request.result || null);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[webMediaDb] Get error:', error);
    return null;
  }
}

export async function deleteMediaBlob(messageId: string): Promise<void> {
  if (!isWeb) return;

  try {
    const db = await getDB();
    if (!db) return;

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(messageId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[webMediaDb] Delete error:', error);
  }
}
