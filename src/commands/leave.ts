import type { CommandHandler } from '../discord/commands.js';
import { reply } from '../discord/commands.js';

export const leaveCommand: CommandHandler = async (message, _args, ctx) => {
  ctx.relayManager.stop();
  ctx.voiceManager.leave();
  await reply(message, 'Left voice channel.');
};
