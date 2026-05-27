import type { CommandHandler } from '../discord/commands.js';
import { reply } from '../discord/commands.js';

export const volumeCommand: CommandHandler = async (message, args, ctx) => {
  if (args.length === 0) {
    const state = await ctx.beefweb.getPlayerState();
    const { min, max, value } = state.volume;
    const pct = Math.round(((value - min) / (max - min)) * 100);
    await reply(message, `Volume: **${pct}%**`);
    return;
  }
  const pct = parseInt(args[0], 10);
  if (isNaN(pct) || pct < 0 || pct > 100) {
    await reply(message, 'Usage: `!volume [0-100]`');
    return;
  }
  await ctx.beefweb.setVolume(pct);
  await reply(message, `Volume set to **${pct}%**.`);
};
