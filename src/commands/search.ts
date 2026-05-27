import type { CommandHandler } from '../discord/commands.js';
import { reply } from '../discord/commands.js';
import { CONFIG } from '../config.js';
import { setSearchResults } from '../monochrome/selection.js';

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export const searchCommand: CommandHandler = async (message, args, ctx) => {
  const query = args.join(' ').trim();
  if (!query) {
    await reply(message, 'Usage: `!search <query>`');
    return;
  }

  let results;
  try {
    results = await ctx.monochrome.search(query, CONFIG.MONOCHROME_SEARCH_LIMIT);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await reply(message, `Search failed: ${msg}`);
    return;
  }

  if (!results.length) {
    await reply(message, `No results for **${query}**.`);
    return;
  }

  setSearchResults(message.userId, results);

  const lines = results.map((t, i) =>
    `**${i + 1}.** ${t.title} — ${t.artists.join(', ') || 'Unknown'} — ${t.album} [${formatDuration(t.durationSec)}]`
  );

  const LIMIT = 1990;
  let content = '';
  for (const line of lines) {
    const next = content ? `${content}\n${line}` : line;
    if (next.length > LIMIT) break;
    content = next;
  }
  const ch = message.channel;
  if (ch && 'send' in ch) {
    const sent = await (ch as any).send(content) as { delete(): Promise<unknown> };
    setTimeout(() => sent.delete().catch(() => {}), 60_000);
  } else {
    await reply(message, content);
  }
};
