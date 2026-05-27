import type { CommandHandler } from '../discord/commands.js';
import { reply } from '../discord/commands.js';

export const shuffleCommand: CommandHandler = async (message, _args, ctx) => {
  const playlistId = await ctx.beefweb.getCurrentPlaylistId();
  await ctx.beefweb.shuffle(playlistId);
  await reply(message, 'Queue shuffled.');
};
