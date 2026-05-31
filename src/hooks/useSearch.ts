/**
 * hooks/useSearch.ts
 * -------------------
 * Search users from Firestore /users collection by displayName (username).
 *
 * Strategy: Firestore doesn't support full-text search, but it DOES support
 * prefix range queries. We do:
 *   where displayName >= query AND displayName < query + '\uf8ff'
 * This is a standard Firestore prefix-match pattern. It's case-sensitive, so
 * we also lowercase both sides for a case-insensitive feel (requires a
 * `displayNameLower` field, OR we just search as-is since usernames are
 * usually typed exactly).
 *
 * We debounce 400ms before firing to avoid hammering Firestore on every key.
 */

import { useState, useCallback, useRef } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  type DocumentData,
} from 'firebase/firestore';
import { db, auth } from '@/config/firebase';
import { type UserProfile } from '@/store/authStore';

export type SearchUser = Pick<
  UserProfile,
  'uid' | 'displayName' | 'name' | 'photoURL' | 'isOnline' | 'lastSeen'
>;

export function useSearch() {
  const [results, setResults] = useState<SearchUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((rawQuery: string) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    const q = rawQuery.trim();
    if (!q) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setError(null);

    debounceTimer.current = setTimeout(async () => {
      try {
        // Firestore prefix-range query on displayName field
        // e.g. query "ni" matches "niru01", "niko", "nishant" etc.
        const end = q + '\uf8ff'; // \uf8ff is the highest Unicode code point, used as a sentinel

        const usersRef = collection(db, 'users');
        const q1 = query(
          usersRef,
          where('displayName', '>=', q),
          where('displayName', '<=', end),
          orderBy('displayName'),
          limit(20)
        );

        const snapshot = await getDocs(q1);
        const currentUid = auth.currentUser?.uid;
        const users: SearchUser[] = snapshot.docs
          .filter((doc) => doc.id !== currentUid) // exclude own profile
          .map((doc) => {
            const data = doc.data() as DocumentData;
            return {
              uid: doc.id,
              displayName: data.displayName ?? '',
              name: data.name ?? '',
              photoURL: data.photoURL ?? null,
              isOnline: data.isOnline ?? false,
              lastSeen: data.lastSeen,
            };
          });

        setResults(users);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Search failed. Please try again.';
        setError(msg);
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 400);
  }, []);

  const clearResults = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    setResults([]);
    setIsSearching(false);
    setError(null);
  }, []);

  return { results, isSearching, error, search, clearResults };
}
