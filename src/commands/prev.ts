import type { CommandHandler } from '../discord/commands.js';
import { reply } from '../discord/commands.js';

export const prevCommand: CommandHandler = async (message, _args, ctx) => {
  await ctx.beefweb.previous();
  await reply(message, 'Back to previous track.');
};
