import type { CommandHandler } from '../discord/commands.js';
import { reply } from '../discord/commands.js';
import { clearQueueStore, getQueueEntries } from '../queue/store.js';

export const clearQueueCommand: CommandHandler = async (message, _args, ctx) => {
  const queueLen = getQueueEntries().length;
  if (queueLen === 0) {
    await reply(message, 'Queue is already empty.');
    return;
  }

  const state = await ctx.player.getPlayerState();
  const currentIndex = state.activeItem?.index ?? -1;

  if (currentIndex >= 0) {
    const playlistId = state.activeItem.playlistId;
    await ctx.player.clearItems(playlistId, currentIndex + 1, queueLen);
  }

  clearQueueStore();
  await reply(message, `Cleared ${queueLen} queued track${queueLen === 1 ? '' : 's'}.`);
};
