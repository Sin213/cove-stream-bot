import type { CommandHandler } from '../discord/commands.js';
import { reply } from '../discord/commands.js';

export const restartCommand: CommandHandler = async (message, _args, ctx) => {
  const state = await ctx.player.getPlayerState();
  if (state.playbackState === 'stopped' || state.activeItem?.index < 0) {
    await reply(message, 'Nothing is currently playing.');
    return;
  }
  await ctx.player.seek(0);
  await reply(message, '⏮ Restarted.');
};
