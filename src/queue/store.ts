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
let _queue: QueueEntry[] = [];

try {
  const raw = readFileSync(PERSIST_PATH, 'utf8');
  _queue = JSON.parse(raw) as QueueEntry[];
} catch { /* first run */ }

function persist(): void {
  try { writeFileSync(PERSIST_PATH, JSON.stringify(_queue)); } catch { /* non-fatal */ }
}

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
    let index = 0;
    for (const entry of _queue) {
      try {
        const url = await monochrome.getStreamUrl(entry.tidalId, undefined, entry.isrc);
        await beefweb.addItems(playlist.id, [url]);
        setTrackMeta(index, url, { title: entry.title, artists: entry.artists, isrc: entry.isrc });
        index++;
      } catch (err) {
        console.warn(`[queue] Failed to restore "${entry.title}":`, err instanceof Error ? err.message : err);
      }
    }
    console.log(`[queue] Restored ${index} track(s).`);
  } catch (err) {
    console.warn('[queue] Restore failed:', err instanceof Error ? err.message : err);
  }
}
