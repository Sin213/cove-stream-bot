import type { CommandHandler } from '../discord/commands.js';
import { reply } from '../discord/commands.js';
import type { GuildMember } from 'discord.js';

export const joinCommand: CommandHandler = async (message, _args, ctx) => {
  const member = message.member as GuildMember | null;

  if (!ctx.voiceManager.isConnected()) {
    if (!member?.voice.channel) {
      await reply(message, 'You must be in a voice channel.');
      return;
    }
    await ctx.voiceManager.join(member.voice.channel);
  }

  if (!ctx.voiceManager.player) {
    await reply(message, 'Voice connection has no player.');
    return;
  }

  ctx.relayManager.start(ctx.voiceManager.player);
  await reply(message, `Joined **${member?.voice.channel?.name ?? 'voice channel'}** and relaying audio.`);
};
