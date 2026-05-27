import type { CommandHandler } from '../discord/commands.js';
import { reply } from '../discord/commands.js';

export const mirrorsCommand: CommandHandler = async (message, _args, ctx) => {
  const stats = ctx.monochrome.getMirrorStats();
  if (stats.length === 0) {
    await reply(message, 'No mirrors configured.');
    return;
  }
  const lines = stats.map(s => {
    const pct = Math.round(s.rate * 100);
    const bar = pct >= 80 ? '🟢' : pct >= 50 ? '🟡' : '🔴';
    return `${bar} \`${s.url}\` — ${s.ok}/${s.total} (${pct}%)`;
  });
  await reply(message, `**Mirror Health**\n${lines.join('\n')}`);
};
