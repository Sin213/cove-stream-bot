import { mkdir, writeFile, readdir, stat, rm, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { CONFIG } from '../config.js';

let tmpSeq = 0;

// DeaDBeeF cannot reliably play remote audio over HTTP (it stalls on, and even
// wedges its streamer with, non-faststart Tidal mp4 streams). It plays LOCAL
// files flawlessly, so we download the resolved stream into a cache dir — which
// must be inside DeaDBeeF's `beefweb.music_dirs` — and hand DeaDBeeF that path.

const CACHE_DIR = CONFIG.STREAM_CACHE_DIR;
const MAX_FILES = CONFIG.STREAM_CACHE_MAX_FILES;
const DOWNLOAD_TIMEOUT_MS = 90_000;

const EXT_BY_CONTENT_TYPE: Record<string, string> = {
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'm4a',
  'audio/aacp': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/flac': 'flac',
  'audio/x-flac': 'flac',
  'audio/ogg': 'ogg',
  'application/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
};

function sanitizeKey(key: string): string {
  return (key.replace(/[^a-zA-Z0-9_-]/g, '') || 'track').slice(0, 48);
}

function extFromUrl(url: string): string | undefined {
  const m = url.split('?')[0].match(/\.([a-z0-9]{2,4})$/i);
  return m ? m[1].toLowerCase() : undefined;
}

/**
 * Downloads `url` into the local cache and returns the local file path.
 * Reuses an existing cached file for the same `key` (so requeuing the same
 * track doesn't re-download). `key` should be stable per track (e.g. the
 * Tidal id), NOT the signed URL (whose token changes each time).
 */
export async function cacheStream(url: string, key: string): Promise<string> {
  await mkdir(CACHE_DIR, { recursive: true });
  const safe = sanitizeKey(key);

  // Reuse a non-empty cached file for this key if present.
  const existing = (await readdir(CACHE_DIR).catch(() => [])).find(f => f.startsWith(`${safe}.`));
  if (existing) {
    const p = join(CACHE_DIR, existing);
    try { if ((await stat(p)).size > 0) return p; } catch { /* fall through to re-download */ }
  }

  const res = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`stream download failed: HTTP ${res.status}`);
  const ct = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  const ext = EXT_BY_CONTENT_TYPE[ct] ?? extFromUrl(url) ?? 'm4a';
  const path = join(CACHE_DIR, `${safe}.${ext}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length === 0) throw new Error('stream download was empty');
  // Write to a unique temp file then atomically rename, so a concurrent reader
  // never sees (and plays) a partially-written cache file. The temp name is
  // dot-prefixed so the reuse scan (`${safe}.`) can't pick it up mid-write.
  const tmp = join(CACHE_DIR, `.${safe}.${process.pid}.${tmpSeq++}.part`);
  await writeFile(tmp, buf);
  await rename(tmp, path);
  void pruneCache();
  return path;
}

/** Keeps the cache bounded to the newest MAX_FILES files by mtime. */
async function pruneCache(): Promise<void> {
  try {
    const names = await readdir(CACHE_DIR);
    if (names.length <= MAX_FILES) return;
    const withTimes = await Promise.all(
      names.map(async (n) => {
        const p = join(CACHE_DIR, n);
        try { return { p, mtime: (await stat(p)).mtimeMs }; } catch { return { p, mtime: 0 }; }
      }),
    );
    withTimes.sort((a, b) => b.mtime - a.mtime);
    await Promise.all(withTimes.slice(MAX_FILES).map(({ p }) => rm(p, { force: true }).catch(() => {})));
  } catch { /* non-fatal */ }
}
