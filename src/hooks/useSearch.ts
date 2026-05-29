/**
 * hooks/useSearch.ts
 * -------------------
 * Hook for searching users by username substring.
 * Debounces the query by 400ms, uses the typed Data Connect SDK.
 */

import { useState, useCallback, useRef } from 'react';
import {
  searchUsersByUsername,
  type SearchUsersByUsernameData,
} from '@/dataconnect-generated';

export type SearchUser = SearchUsersByUsernameData['users'][0];

export function useSearch() {
  const [results, setResults] = useState<SearchUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((rawQuery: string) => {
    // Clear pending timer
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
        const result = await searchUsersByUsername({ query: q });
        setResults(result.data.users ?? []);
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
