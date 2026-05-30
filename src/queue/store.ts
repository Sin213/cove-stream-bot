import { readFileSync, renameSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import type { MonochromeClient } from '../monochrome/client.js';
import type { PlayerBackend } from '../player/types.js';
import { setTrackMeta } from '../monochrome/trackMeta.js';
import { cacheStream } from '../resolve/cache.js';
import { CONFIG } from '../config.js';

export interface QueueEntry {
  tidalId?: number;
  isrc?: string;
  title: string;
  artists: string[];
  local?: boolean;
}

const PERSIST_PATH = resolve(process.cwd(), 'queue.json');
const DEBOUNCE_MS = 500;
const RESTORE_CONCURRENCY = 3;
const MAX_QUEUE = 500; // safety bound; the queue self-drains as tracks play
let _queue: QueueEntry[] = [];
let _persistTimer: ReturnType<typeof setTimeout> | null = null;

try {
  const raw = readFileSync(PERSIST_PATH, 'utf8');
  _queue = JSON.parse(raw) as QueueEntry[];
} catch { /* first run */ }

function flushSync(): void {
  try {
    const tmpPath = `${PERSIST_PATH}.tmp`;
    writeFileSync(tmpPath, JSON.stringify(_queue));
    renameSync(tmpPath, PERSIST_PATH);
  } catch { /* non-fatal */ }
}

function persist(): void {
  if (_persistTimer) return;
  _persistTimer = setTimeout(() => { _persistTimer = null; flushSync(); }, DEBOUNCE_MS);
}

async function mapLimited<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;

  async function worker(): Promise<void> {
    while (next < items.length) {
      const index = next++;
      try {
        results[index] = { status: 'fulfilled', value: await fn(items[index], index) };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker())
  );
  return results;
}

process.on('exit', () => {
  if (_persistTimer) { clearTimeout(_persistTimer); flushSync(); }
});

export function appendToQueue(entry: QueueEntry): void {
  _queue.push(entry);
  if (_queue.length > MAX_QUEUE) _queue.shift();
  persist();
}

export function removeFromQueue(zeroBasedIndex: number): void {
  if (zeroBasedIndex >= 0 && zeroBasedIndex < _queue.length) {
    _queue.splice(zeroBasedIndex, 1);
    persist();
  }
}

export function advanceQueue(): void {
  if (_queue.length > 0) { _queue.shift(); persist(); }
}

export function clearQueueStore(): void {
  _queue = [];
  persist();
}

export function getQueueEntries(): QueueEntry[] {
  return [..._queue];
}

export async function restoreQueue(player: PlayerBackend, monochrome: MonochromeClient): Promise<void> {
  const restorable = _queue.filter(e => e.tidalId != null);
  if (restorable.length === 0) return;
  try {
    const playlists = await player.getPlaylists();
    const playlist = playlists.find(p => p.isCurrent) ?? playlists[0];
    if (!playlist || playlist.itemCount > 0) return;

    console.log(`[queue] Restoring ${restorable.length} queued track(s)…`);
    const resolved = await mapLimited(
      restorable,
      RESTORE_CONCURRENCY,
      entry => monochrome.getStreamUrl(entry.tidalId!, undefined, entry.isrc)
        .then(url => ({ entry, url }))
    );
    let added = 0;
    for (let i = 0; i < resolved.length; i++) {
      const result = resolved[i];
      if (result.status === 'rejected') {
        const entry = restorable[i];
        console.warn(`[queue] Failed to restore "${entry?.title}":`, result.reason instanceof Error ? result.reason.message : result.reason);
      } else {
        const { entry, url } = result.value;
        // Download to a local cache file when enabled — DeaDBeeF can't reliably
        // stream URLs (skipped when STREAM_DOWNLOAD is off, e.g. foobar2000).
        let playPath = url;
        if (CONFIG.STREAM_DOWNLOAD) {
          try {
            playPath = await cacheStream(url, `t${entry.tidalId}`);
          } catch (err) {
            console.warn(`[queue] Failed to cache "${entry.title}":`, err instanceof Error ? err.message : err);
            continue;
          }
        }
        await player.addItems(playlist.id, [playPath]);
        // Tracks append to the empty playlist in order, so the real track index
        // is the count of successfully-added items — not the resolved-array
        // position `i` (which also counts the entries that failed to resolve).
        setTrackMeta(added, playPath, { title: entry.title, artists: entry.artists, isrc: entry.isrc });
        added++;
      }
    }
    console.log(`[queue] Restored ${added}/${restorable.length} track(s).`);
  } catch (err) {
    console.warn('[queue] Restore failed:', err instanceof Error ? err.message : err);
  }
}
