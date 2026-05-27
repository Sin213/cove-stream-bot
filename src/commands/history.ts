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
    const artist = e.artists[0] ?? '';
    const ts = `<t:${Math.floor(e.playedAt / 1000)}:t>`;
    const label = artist ? `**${e.title}** — ${artist}` : `**${e.title}**`;
    return `${i + 1}. ${label} ${ts}`;
  });
  await reply(message, lines.join('\n'));
};
