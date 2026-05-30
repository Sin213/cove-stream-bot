import type { CommandHandler } from '../discord/commands.js';
import { reply } from '../discord/commands.js';
import { clearSearchResults } from '../monochrome/selection.js';

export interface LocalResult {
  playlistId: string;
  index: number;
  title: string;
  artist: string;
  album: string;
  path: string;
}

interface Deletable { delete(): Promise<unknown> }

interface StoredLocal {
  results: LocalResult[];
  ts: number;
  message?: Deletable;
}

const TTL_MS = 5 * 60 * 1000;
const SWEEP_THRESHOLD = 50;
const store = new Map<string, StoredLocal>();

function sweepExpired(): void {
  const cutoff = Date.now() - TTL_MS;
  for (const [id, entry] of store) {
    if (entry.ts < cutoff) store.delete(id);
  }
}

export function setLocalResults(userId: string, results: LocalResult[], message?: Deletable): void {
  store.set(userId, { results, ts: Date.now(), message });
  if (store.size > SWEEP_THRESHOLD) sweepExpired();
}

export function clearLocalResults(userId: string): void {
  store.delete(userId);
}

export function getLocalResult(userId: string, index: number): LocalResult | null {
  const entry = store.get(userId);
  if (!entry) return null;
  if (Date.now() - entry.ts > TTL_MS) {
    store.delete(userId);
    return null;
  }
  if (index < 1 || index > entry.results.length) return null;
  return entry.results[index - 1];
}

export function consumeLocalMessage(userId: string): Deletable | undefined {
  const entry = store.get(userId);
  const msg = entry?.message;
  if (entry) entry.message = undefined;
  return msg;
}

export const localCommand: CommandHandler = async (message, args, ctx) => {
  clearSearchResults(message.userId);
  const query = args.join(' ').trim().toLowerCase();
  if (!query) {
    await reply(message, 'Usage: `!local <query>` — search your local player library');
    return;
  }

  const playlists = await ctx.player.getPlaylists();
  const matches: LocalResult[] = [];
  const seenPaths = new Set<string>();
  const MAX_RESULTS = 10;
  const PAGE = 200;
  const words = query.split(/\s+/);

  // Page through items and stop as soon as we have enough matches, instead of
  // pulling every track of every playlist into memory up front.
  outer:
  for (const pl of playlists) {
    for (let offset = 0; offset < pl.itemCount; offset += PAGE) {
      const items = await ctx.player.getPlaylistItems(pl.id, offset, PAGE);
      if (items.length === 0) break;
      for (let i = 0; i < items.length; i++) {
        const cols = items[i].columns;
        const artist = cols[0] || 'Unknown';
        const title = cols[1] || 'Unknown';
        const album = cols[2] || 'Unknown';
        const path = cols[3] || '';
        if (path.startsWith('http')) continue;
        if (seenPaths.has(path)) continue;
        const haystack = `${artist} ${title}`.toLowerCase();
        if (words.every(word => haystack.includes(word))) {
          seenPaths.add(path);
          matches.push({ playlistId: pl.id, index: offset + i, title, artist, album, path });
          if (matches.length >= MAX_RESULTS) break outer;
        }
      }
    }
  }

  if (!matches.length) {
    await reply(message, `No local tracks matching **${args.join(' ')}**.`);
    return;
  }

  const lines = matches.map((m, i) =>
    `**${i + 1}.** ${m.title} — ${m.artist}`
  );

  const content = lines.join('\n') + '\nPick a track with `!play <number>`.';
  const ch = message.channel;
  if (ch && 'send' in ch) {
    const sent = await (ch as any).send(content) as { delete(): Promise<unknown> };
    setLocalResults(message.userId, matches, sent);
    setTimeout(() => sent.delete().catch(() => {}), 30_000);
  } else {
    setLocalResults(message.userId, matches);
    await reply(message, content);
  }
};
