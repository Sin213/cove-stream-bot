import type { TrackMatch } from './types.js';

interface Deletable { delete(): Promise<unknown> }

interface StoredSearch {
  results: TrackMatch[];
  ts: number;
  message?: Deletable;
}

const TTL_MS = 5 * 60 * 1000;
const SWEEP_THRESHOLD = 50;
const store = new Map<string, StoredSearch>();

function sweepExpired(): void {
  const cutoff = Date.now() - TTL_MS;
  for (const [id, entry] of store) {
    if (entry.ts < cutoff) store.delete(id);
  }
}

export function setSearchResults(userId: string, results: TrackMatch[], message?: Deletable): void {
  store.set(userId, { results, ts: Date.now(), message });
  // Drop stale entries from inactive users so the store can't grow unbounded.
  if (store.size > SWEEP_THRESHOLD) sweepExpired();
}

export function clearSearchResults(userId: string): void {
  store.delete(userId);
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

export function consumeSearchMessage(userId: string): Deletable | undefined {
  const entry = store.get(userId);
  const msg = entry?.message;
  if (entry) entry.message = undefined;
  return msg;
}
