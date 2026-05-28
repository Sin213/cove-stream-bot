import type { CommandHandler } from '../discord/commands.js';
import { reply } from '../discord/commands.js';

export const monochromeCommand: CommandHandler = async (message, args, ctx) => {
  const action = args[0]?.toLowerCase();

  if (action === 'on') {
    ctx.monochrome.enabled = true;
    await reply(message, 'Online search enabled — `!search` and `!play <url>` will use Monochrome mirrors.');
    return;
  }

  if (action === 'off') {
    ctx.monochrome.enabled = false;
    await reply(message, 'Online search disabled — local-only mode. Use `!local` to browse your library.');
    return;
  }

  const status = ctx.monochrome.enabled ? 'on' : 'off';
  await reply(message, `Online search is **${status}**. Usage: \`!monochrome on\` / \`!monochrome off\``);
};
