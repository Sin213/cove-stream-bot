import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import type { MonochromeClient } from '../monochrome/client.js';
import type { BeefwebClient } from '../beefweb/client.js';
import { setTrackMeta } from '../monochrome/trackMeta.js';

export interface QueueEntry {
  tidalId: number;
  isrc?: string;
  title: string;
  artists: string[];
}

const PERSIST_PATH = resolve(process.cwd(), 'queue.json');
const DEBOUNCE_MS = 500;
let _queue: QueueEntry[] = [];
let _persistTimer: ReturnType<typeof setTimeout> | null = null;

try {
  const raw = readFileSync(PERSIST_PATH, 'utf8');
  _queue = JSON.parse(raw) as QueueEntry[];
} catch { /* first run */ }

function flushSync(): void {
  try { writeFileSync(PERSIST_PATH, JSON.stringify(_queue)); } catch { /* non-fatal */ }
}

function persist(): void {
  if (_persistTimer) return;
  _persistTimer = setTimeout(() => { _persistTimer = null; flushSync(); }, DEBOUNCE_MS);
}

process.on('exit', () => {
  if (_persistTimer) { clearTimeout(_persistTimer); flushSync(); }
});

export function appendToQueue(entry: QueueEntry): void {
  _queue.push(entry);
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

export async function restoreQueue(beefweb: BeefwebClient, monochrome: MonochromeClient): Promise<void> {
  if (_queue.length === 0) return;
  try {
    const playlists = await beefweb.getPlaylists();
    const playlist = playlists.find(p => p.isCurrent) ?? playlists[0];
    if (!playlist || playlist.itemCount > 0) return; // don't restore if playlist has content

    console.log(`[queue] Restoring ${_queue.length} queued track(s)…`);
    const resolved = await Promise.allSettled(
      _queue.map(entry => monochrome.getStreamUrl(entry.tidalId, undefined, entry.isrc)
        .then(url => ({ entry, url })))
    );
    let index = 0;
    for (const result of resolved) {
      if (result.status === 'rejected') {
        const entry = _queue[index];
        console.warn(`[queue] Failed to restore "${entry?.title}":`, result.reason instanceof Error ? result.reason.message : result.reason);
      } else {
        const { entry, url } = result.value;
        await beefweb.addItems(playlist.id, [url]);
        setTrackMeta(index, url, { title: entry.title, artists: entry.artists, isrc: entry.isrc });
      }
      index++;
    }
    const ok = resolved.filter(r => r.status === 'fulfilled').length;
    console.log(`[queue] Restored ${ok}/${_queue.length} track(s).`);
  } catch (err) {
    console.warn('[queue] Restore failed:', err instanceof Error ? err.message : err);
  }
}
