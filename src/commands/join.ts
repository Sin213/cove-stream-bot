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
    await ctx.voiceManager.join(member.voice.channel, () => ctx.relayManager.stop());
  }

  if (!ctx.voiceManager.player) {
    await reply(message, 'Voice connection has no player.');
    return;
  }

  ctx.relayManager.start(ctx.voiceManager.player);
  const ch = message.channel;
  if (ch && 'send' in ch) {
    const sent = await (ch as any).send(`Joined **${member?.voice.channel?.name ?? 'voice channel'}** and relaying audio.`);
    setTimeout(() => sent.delete().catch(() => {}), 5_000);
  } else {
    await reply(message, `Joined **${member?.voice.channel?.name ?? 'voice channel'}** and relaying audio.`);
  }
};
