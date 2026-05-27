import type { CommandHandler } from '../discord/commands.js';
import { reply } from '../discord/commands.js';
import type { GuildMember } from 'discord.js';

export const relayCommand: CommandHandler = async (message, _args, ctx) => {
  const member = message.member as GuildMember | null;

  if (!ctx.voiceManager.isConnected()) {
    if (!member?.voice.channel) {
      await reply(message, 'Join a voice channel first, or use `!join`.');
      return;
    }
    await ctx.voiceManager.join(member.voice.channel);
  }

  if (!ctx.voiceManager.player) {
    await reply(message, 'Voice connection has no player.');
    return;
  }

  ctx.relayManager.start(ctx.voiceManager.player);
  await reply(message, 'Relaying player audio to voice channel.');
};
