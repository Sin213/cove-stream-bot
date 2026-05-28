import type { CommandHandler } from '../discord/commands.js';
import { reply } from '../discord/commands.js';

export const pauseCommand: CommandHandler = async (message, _args, ctx) => {
  const state = await ctx.player.getPlayerState();
  if (state.playbackState === 'playing') {
    await ctx.player.pause();
    await reply(message, 'Playback paused.');
  } else if (state.playbackState === 'paused') {
    await reply(message, 'Already paused.');
  } else {
    await reply(message, 'Playback is stopped.');
  }
};
