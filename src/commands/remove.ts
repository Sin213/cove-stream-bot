import type { CommandHandler } from '../discord/commands.js';
import { reply } from '../discord/commands.js';
import { getTrackMeta } from '../monochrome/trackMeta.js';
import { removeFromQueue } from '../queue/store.js';

export const removeCommand: CommandHandler = async (message, args, ctx) => {
  const n = parseInt(args[0] ?? '', 10);
  if (!Number.isInteger(n) || n < 1) {
    await reply(message, 'Usage: `!remove <position>` — position matches numbers shown in `!queue`');
    return;
  }

  const [state, playlistId] = await Promise.all([
    ctx.beefweb.getPlayerState(),
    ctx.beefweb.getCurrentPlaylistId(),
  ]);

  const currentIndex = state.activeItem?.index ?? -1;
  const absoluteIndex = (currentIndex >= 0 ? currentIndex + 1 : 0) + (n - 1);

  const items = await ctx.beefweb.getPlaylistItems(playlistId, absoluteIndex, 1);
  if (!items.length) {
    await reply(message, `No track at position ${n}.`);
    return;
  }

  const cols = items[0].columns;
  const stored = getTrackMeta(absoluteIndex, cols[3]);
  const title = stored?.title || cols[1] || 'Unknown';
  const artist = stored?.artists[0] || cols[0] || 'Unknown';

  await ctx.beefweb.removeItem(playlistId, absoluteIndex);
  removeFromQueue(n - 1);
  await reply(message, `Removed: ${title} — ${artist}`);
};
