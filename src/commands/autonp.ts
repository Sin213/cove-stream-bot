import type { CommandHandler } from '../discord/commands.js';
import { reply } from '../discord/commands.js';

export const autonpCommand: CommandHandler = async (message, _args, ctx) => {
  if (ctx.guildState.announceChannelId) {
    ctx.guildState.announceChannelId = null;
    await reply(message, 'Auto now-playing disabled.');
  } else {
    if (!message.channel) {
      await reply(message, 'Cannot determine channel.');
      return;
    }
    ctx.guildState.announceChannelId = message.channel.id;
    await reply(message, 'Auto now-playing enabled in this channel.');
  }
};
