import type { TrackMatch } from './types.js';

interface StoredSearch {
  results: TrackMatch[];
  ts: number;
}

const TTL_MS = 5 * 60 * 1000;
const store = new Map<string, StoredSearch>();

export function setSearchResults(userId: string, results: TrackMatch[]): void {
  store.set(userId, { results, ts: Date.now() });
}

export function getSearchResult(userId: string, index: number): TrackMatch | null {
  const entry = store.get(userId);
  if (!entry) return null;
  if (Date.now() - entry.ts > TTL_MS) {
    store.delete(userId);
    return null;
  }
  if (index < 1 || index > entry.results.length) return null;
  return entry.results[index - 1];
}
