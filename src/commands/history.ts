import type { CommandHandler } from '../discord/commands.js';
import { reply } from '../discord/commands.js';
import { getHistory } from '../history/store.js';

export const historyCommand: CommandHandler = async (message, _args, _ctx) => {
  const entries = getHistory();
  if (entries.length === 0) {
    await reply(message, 'No play history yet.');
    return;
  }
  const lines = entries.slice(0, 10).map((e, i) => {
    const artist = e.artists[0] ?? 'Unknown';
    const time = new Date(e.playedAt).toLocaleTimeString();
    return `${i + 1}. **${e.title}** — ${artist} *(${time})*`;
  });
  await reply(message, lines.join('\n'));
};
