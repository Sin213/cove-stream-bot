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

  function looksLikeUrl(s: string): boolean {
    return s.startsWith('http') || s.includes('://') || (s.includes('?') && s.includes('='));
  }

  const rawTitle = track.title !== 'Unknown' && !looksLikeUrl(track.title) ? track.title : null;
  const rawArtist = track.artist !== 'Unknown' && !looksLikeUrl(track.artist) ? track.artist : null;
  const title = stored?.title || rawTitle || null;
  const artist = stored?.artists[0] || rawArtist || null;
  const bar = progressBar(track.position, track.duration);
  const pos = formatDuration(track.position);
  const dur = formatDuration(track.duration);

  const embed = new EmbedBuilder()
    .addFields({ name: '​', value: `\`[${bar}]\` ${pos} / ${dur}` })
    .setColor(0x1db954);

  if (title) embed.setTitle(title);
  if (artist) embed.setDescription(artist);

  if (stored?.albumArtUrl) embed.setThumbnail(stored.albumArtUrl);

  await message.reply({ embeds: [embed] });
};
