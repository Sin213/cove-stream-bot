import type { CommandHandler } from '../discord/commands.js';
import { reply } from '../discord/commands.js';
import type { GuildMember } from 'discord.js';

export const joinCommand: CommandHandler = async (message, _args, ctx) => {
  const member = message.member as GuildMember | null;
  if (!member?.voice.channel) {
    await reply(message, 'You must be in a voice channel.');
    return;
  }

  await ctx.voiceManager.join(member.voice.channel);
  await reply(message, `Joined **${member.voice.channel.name}**. Use \`!relay\` to start streaming.`);
};
