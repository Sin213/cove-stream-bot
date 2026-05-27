import { readFileSync, renameSync, writeFileSync } from 'fs';
import { resolve } from 'path';

export interface TrackMeta {
  title: string;
  artists: string[];
  isrc?: string;
  albumArtUrl?: string;
}

interface StoredEntry {
  meta: TrackMeta;
  ts: number;
}

const PERSIST_PATH = resolve(process.cwd(), 'track-meta.json');
const TTL_MS = 4 * 60 * 60 * 1000;
const DEBOUNCE_MS = 500;

const indexMeta = new Map<number, TrackMeta>();
const urlMeta = new Map<string, TrackMeta>();
const timestamps = new Map<string, number>();

try {
  const raw = readFileSync(PERSIST_PATH, 'utf8');
  const stored = JSON.parse(raw) as {
    byIndex?: [number, StoredEntry][];
    byUrl?: [string, StoredEntry][];
  };
  const cutoff = Date.now() - TTL_MS;
  for (const [k, v] of stored.byIndex ?? []) {
    if (v.ts >= cutoff) { indexMeta.set(k, v.meta); timestamps.set(`i:${k}`, v.ts); }
  }
  for (const [k, v] of stored.byUrl ?? []) {
    if (v.ts >= cutoff) { urlMeta.set(k, v.meta); timestamps.set(k, v.ts); }
  }
} catch { /* first run or corrupt — start fresh */ }

let _persistTimer: ReturnType<typeof setTimeout> | null = null;

function flushSync(): void {
  try {
    const byIndex: [number, StoredEntry][] = [...indexMeta.entries()].map(
      ([k, v]) => [k, { meta: v, ts: timestamps.get(`i:${k}`) ?? Date.now() }]
    );
    const byUrl: [string, StoredEntry][] = [...urlMeta.entries()].map(
      ([k, v]) => [k, { meta: v, ts: timestamps.get(k) ?? Date.now() }]
    );
    const tmpPath = `${PERSIST_PATH}.tmp`;
    writeFileSync(tmpPath, JSON.stringify({ byIndex, byUrl }));
    renameSync(tmpPath, PERSIST_PATH);
  } catch { /* non-fatal */ }
}

function persist(): void {
  if (_persistTimer) return;
  _persistTimer = setTimeout(() => {
    _persistTimer = null;
    flushSync();
  }, DEBOUNCE_MS);
}

process.on('exit', () => {
  if (_persistTimer) { clearTimeout(_persistTimer); flushSync(); }
});

export function setTrackMeta(playlistIndex: number, url: string, entry: TrackMeta): void {
  const now = Date.now();
  indexMeta.set(playlistIndex, entry);
  timestamps.set(`i:${playlistIndex}`, now);
  if (url) {
    urlMeta.set(url, entry);
    timestamps.set(url, now);
  }
  persist();
}

export function getTrackMeta(playlistIndex: number, url?: string): TrackMeta | undefined {
  return (url ? urlMeta.get(url) : undefined) ?? indexMeta.get(playlistIndex);
}

export function pruneTrackMeta(beforeIndex: number): void {
  for (const key of indexMeta.keys()) {
    if (key < beforeIndex - 1) {
      indexMeta.delete(key);
      timestamps.delete(`i:${key}`);
    }
  }
  persist();
}
