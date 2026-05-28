import type { CommandHandler } from '../discord/commands.js';
import { reply } from '../discord/commands.js';
import { CONFIG } from '../config.js';
import { queueTrack } from './play.js';
import { clearLocalResults } from './local.js';

export const autosearchCommand: CommandHandler = async (message, args, ctx) => {
  if (!ctx.monochrome.enabled) {
    await reply(message, 'Online search is disabled. Use `!local <query>` or `!monochrome on` to re-enable.');
    return;
  }
  clearLocalResults(message.userId);
  const query = args.join(' ').trim();
  if (!query) {
    await reply(message, 'Usage: `!autosearch <query>`');
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

  await queueTrack(message, ctx, results[0]);
};
