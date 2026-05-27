import type { CommandHandler } from '../discord/commands.js';
import { reply } from '../discord/commands.js';

export const nextCommand: CommandHandler = async (message, _args, ctx) => {
  await ctx.beefweb.next();
  await reply(message, 'Skipped to next track.');
};
