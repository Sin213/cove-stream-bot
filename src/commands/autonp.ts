import type { CommandHandler } from '../discord/commands.js';
import { reply } from '../discord/commands.js';
import { setAnnounceChannelId, getAnnounceChannelId } from '../autonp/state.js';

export const autonpCommand: CommandHandler = async (message, _args, _ctx) => {
  if (getAnnounceChannelId()) {
    setAnnounceChannelId(null);
    await reply(message, 'Auto now-playing disabled.');
  } else {
    if (!message.channel) {
      await reply(message, 'Cannot determine channel.');
      return;
    }
    setAnnounceChannelId(message.channel.id);
    await reply(message, 'Auto now-playing enabled in this channel.');
  }
};
