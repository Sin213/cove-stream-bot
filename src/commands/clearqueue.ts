import type { CommandHandler } from '../discord/commands.js';
import { reply } from '../discord/commands.js';
import { clearQueueStore } from '../queue/store.js';

export const clearQueueCommand: CommandHandler = async (message, _args, ctx) => {
  const [state, playlists] = await Promise.all([
    ctx.beefweb.getPlayerState(),
    ctx.beefweb.getPlaylists(),
  ]);

  const playlist = playlists.find(p => p.isCurrent) ?? playlists[0];
  if (!playlist) {
    await reply(message, 'No playlist found.');
    return;
  }

  const currentIndex = state.activeItem?.index ?? -1;
  const isPlaying = state.playbackState !== 'stopped' && currentIndex >= 0;

  if (isPlaying) {
    // Keep current track, remove everything after it
    const remaining = playlist.itemCount - (currentIndex + 1);
    await ctx.beefweb.clearItems(playlist.id, currentIndex + 1, remaining);
    clearQueueStore();
    await reply(message, `Queue cleared. Current track kept.`);
  } else {
    await ctx.beefweb.clearItems(playlist.id, 0, playlist.itemCount);
    clearQueueStore();
    await reply(message, 'Queue cleared.');
  }
};
