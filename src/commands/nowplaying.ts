import type { CommandHandler } from '../discord/commands.js';
import { EmbedBuilder } from 'discord.js';
import { getTrackMeta } from '../monochrome/trackMeta.js';

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function progressBar(position: number, duration: number, width = 16): string {
  const filled = duration > 0 ? Math.round((position / duration) * width) : 0;
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

export const nowplayingCommand: CommandHandler = async (message, _args, ctx) => {
  const track = await ctx.beefweb.getCurrentTrack();
  if (!track) {
    await message.reply('Nothing is currently playing.');
    return;
  }

  const stored = getTrackMeta(track.trackIndex, track.path);
  const title = stored?.title || track.title;
  const artist = stored?.artists[0] || track.artist;
  const bar = progressBar(track.position, track.duration);
  const pos = formatDuration(track.position);
  const dur = formatDuration(track.duration);

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(`${artist}`)
    .addFields({ name: '​', value: `\`[${bar}]\` ${pos} / ${dur}` })
    .setColor(0x1db954);

  if (stored?.albumArtUrl) embed.setThumbnail(stored.albumArtUrl);

  await message.reply({ embeds: [embed] });
};
