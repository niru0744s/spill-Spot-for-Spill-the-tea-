/**
 * services/mmkv.ts
 * -----------------
 * Platform-safe storage adapter.
 *
 * - Native (Android/iOS): uses react-native-mmkv (C++ speed, persistent)
 * - Web / fallback:       uses localStorage (web) or in-memory Map (SSR/test)
 *
 * All consumers import `storage` from here — never instantiate MMKV directly.
 */

import { Platform } from 'react-native';

// ---------------------------------------------------------------------------
// Shared interface — mirrors the MMKV public API we actually use
// ---------------------------------------------------------------------------
export interface StorageAdapter {
  set(key: string, value: string | number | boolean): void;
  getString(key: string): string | undefined;
  getNumber(key: string): number | undefined;
  getBoolean(key: string): boolean | undefined;
  remove(key: string): void;
  addOnValueChangedListener(callback: (key: string) => void): { remove(): void };
}

// ---------------------------------------------------------------------------
// Web adapter — uses localStorage so data survives page refresh
// ---------------------------------------------------------------------------
function createWebStorage(): StorageAdapter {
  const canUseLS = typeof localStorage !== 'undefined';

  return {
    set(key, value) {
      if (canUseLS) localStorage.setItem(key, JSON.stringify(value));
    },
    getString(key) {
      if (!canUseLS) return undefined;
      const raw = localStorage.getItem(key);
      if (raw === null) return undefined;
      try { return JSON.parse(raw) as string; } catch { return raw; }
    },
    getNumber(key) {
      if (!canUseLS) return undefined;
      const raw = localStorage.getItem(key);
      if (raw === null) return undefined;
      const n = Number(JSON.parse(raw));
      return isNaN(n) ? undefined : n;
    },
    getBoolean(key) {
      if (!canUseLS) return undefined;
      const raw = localStorage.getItem(key);
      if (raw === null) return undefined;
      return JSON.parse(raw) === true;
    },
    remove(key) {
      if (canUseLS) localStorage.removeItem(key);
    },
    addOnValueChangedListener(callback) {
      return { remove: () => {} };
    },
  };
}

// ---------------------------------------------------------------------------
// Platform-safe storage adapter creator
// ---------------------------------------------------------------------------
export function createStorageAdapter(id: string): StorageAdapter {
  if (Platform.OS === 'web') {
    return createWebStorage();
  }
  try {
    // Dynamic require so web bundler never touches this code path
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createMMKV } = require('react-native-mmkv') as typeof import('react-native-mmkv');
    const mmkv = createMMKV({ id });
    // Wrap to normalise API: StorageAdapter uses remove(), MMKV v4 also uses remove() ✅
    return {
      set:        (k, v) => mmkv.set(k, v),
      getString:  (k) => mmkv.getString(k),
      getNumber:  (k) => mmkv.getNumber(k),
      getBoolean: (k) => mmkv.getBoolean(k),
      remove:     (k) => mmkv.remove(k),
      addOnValueChangedListener: (cb) => mmkv.addOnValueChangedListener(cb),
    };
  } catch (e) {
    console.warn(`[storage] MMKV init failed for ${id}, falling back to in-memory store:`, e);
    return createInMemoryStorage();
  }
}

// ---------------------------------------------------------------------------
// In-memory fallback (never persists — only used if MMKV init throws)
// ---------------------------------------------------------------------------
function createInMemoryStorage(): StorageAdapter {
  const map = new Map<string, string | number | boolean>();
  return {
    set:        (k, v) => { map.set(k, v); },
    getString:  (k) => { const v = map.get(k); return typeof v === 'string' ? v : undefined; },
    getNumber:  (k) => { const v = map.get(k); return typeof v === 'number' ? v : undefined; },
    getBoolean: (k) => { const v = map.get(k); return typeof v === 'boolean' ? v : undefined; },
    remove:     (k) => { map.delete(k); },
    addOnValueChangedListener: (cb) => {
      return { remove: () => {} };
    },
  };
}

// ---------------------------------------------------------------------------
// Export the right adapters for the current platform
// ---------------------------------------------------------------------------
export const storage: StorageAdapter = createStorageAdapter('spill-chat-storage');
export const authStorage: StorageAdapter = createStorageAdapter('firebase-auth-persistence');
