import type { CommandHandler } from '../discord/commands.js';
import { reply } from '../discord/commands.js';

export const stopCommand: CommandHandler = async (message, _args, ctx) => {
  await ctx.beefweb.stop();
  ctx.relayManager.stop();
  await reply(message, 'Playback stopped and relay ended.');
};
