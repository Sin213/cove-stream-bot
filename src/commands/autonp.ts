import type { CommandHandler } from '../discord/commands.js';
import { reply } from '../discord/commands.js';
import { setAnnounceChannel, getAnnounceChannel } from '../autonp/state.js';

export const autonpCommand: CommandHandler = async (message, _args, _ctx) => {
  if (getAnnounceChannel()) {
    setAnnounceChannel(null);
    await reply(message, 'Auto now-playing disabled.');
  } else {
    setAnnounceChannel(message.channel as { send(content: string): Promise<unknown> });
    await reply(message, 'Auto now-playing enabled in this channel.');
  }
};
