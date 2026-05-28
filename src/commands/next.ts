import type { CommandHandler } from '../discord/commands.js';
import { reply } from '../discord/commands.js';
import { getQueueEntries } from '../queue/store.js';

export const nextCommand: CommandHandler = async (message, _args, ctx) => {
  const queueLen = getQueueEntries().length;
  if (queueLen > 0) {
    const state = await ctx.player.getPlayerState();
    const currentIndex = state.activeItem?.index ?? -1;
    if (currentIndex >= 0) {
      const playlistId = state.activeItem.playlistId;
      await ctx.player.playItem(playlistId, currentIndex + 1);
      await reply(message, 'Skipped to next track.');
      return;
    }
  }
  await ctx.player.next();
  await reply(message, 'Skipped to next track.');
};
