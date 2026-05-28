import type { CommandHandler } from '../discord/commands.js';
import { reply } from '../discord/commands.js';

export const shuffleCommand: CommandHandler = async (message, _args, ctx) => {
  const playlistId = await ctx.player.getCurrentPlaylistId();
  await ctx.player.shuffle(playlistId);
  await reply(message, 'Queue shuffled.');
};
