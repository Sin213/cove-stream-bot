import type { CommandHandler } from '../discord/commands.js';
import { reply } from '../discord/commands.js';

interface LocalResult {
  playlistId: string;
  index: number;
  title: string;
  artist: string;
}

interface Deletable { delete(): Promise<unknown> }

interface StoredLocal {
  results: LocalResult[];
  ts: number;
  message?: Deletable;
}

const TTL_MS = 5 * 60 * 1000;
const store = new Map<string, StoredLocal>();

export function setLocalResults(userId: string, results: LocalResult[], message?: Deletable): void {
  store.set(userId, { results, ts: Date.now(), message });
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
  const query = args.join(' ').trim().toLowerCase();
  if (!query) {
    await reply(message, 'Usage: `!local <query>` — search your local player library');
    return;
  }

  const playlists = await ctx.player.getPlaylists();
  const matches: LocalResult[] = [];
  const MAX_RESULTS = 10;

  for (const pl of playlists) {
    if (matches.length >= MAX_RESULTS) break;
    const items = await ctx.player.getPlaylistItems(pl.id, 0, pl.itemCount);
    for (let i = 0; i < items.length; i++) {
      const cols = items[i].columns;
      const artist = cols[0] || 'Unknown';
      const title = cols[1] || 'Unknown';
      const path = cols[3] || '';
      if (path.startsWith('http')) continue;
      const haystack = `${artist} ${title}`.toLowerCase();
      if (query.split(/\s+/).every(word => haystack.includes(word))) {
        matches.push({ playlistId: pl.id, index: i, title, artist });
        if (matches.length >= MAX_RESULTS) break;
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

  const content = lines.join('\n');
  const ch = message.channel;
  if (ch && 'send' in ch) {
    const sent = await (ch as any).send(content) as { delete(): Promise<unknown> };
    setLocalResults(message.userId, matches, sent);
    setTimeout(() => sent.delete().catch(() => {}), 10_000);
  } else {
    setLocalResults(message.userId, matches);
    await reply(message, content);
  }

  await reply(message, 'Pick a track with `!play <number>`.');
};
