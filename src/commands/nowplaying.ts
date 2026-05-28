import type { CommandHandler } from '../discord/commands.js';
import { AttachmentBuilder, EmbedBuilder } from 'discord.js';
import { getTrackMeta } from '../monochrome/trackMeta.js';
import { CONFIG } from '../config.js';

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '?:??';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function progressBar(position: number, duration: number, width = 16): string {
  const ratio = duration > 0 ? Math.max(0, Math.min(1, position / duration)) : 0;
  const filled = Math.round(ratio * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function looksLikeUrl(s: string): boolean {
  return s.startsWith('http') || s.includes('://') || (s.includes('?') && s.includes('='));
}

function displayValue(value: string): string | null {
  return value !== 'Unknown' && !looksLikeUrl(value) ? value : null;
}

function isHttpUrl(value: string): boolean {
  return value.startsWith('http://') || value.startsWith('https://');
}

export const nowplayingCommand: CommandHandler = async (message, _args, ctx) => {
  const [state, track] = await Promise.all([
    ctx.player.getPlayerState(),
    ctx.player.getCurrentTrack(),
  ]);
  if (!track) {
    await message.reply('Nothing is currently playing.');
    return;
  }

  const stored = getTrackMeta(track.trackIndex, track.path);
  const rawTitle = displayValue(track.title);
  const rawArtist = displayValue(track.artist);
  const rawAlbum = displayValue(track.album);
  const title = stored?.title || rawTitle || null;
  const artists = stored?.artists?.length ? stored.artists.join(', ') : rawArtist;
  const album = rawAlbum;
  const bar = progressBar(track.position, track.duration);
  const pos = formatDuration(track.position);
  const dur = formatDuration(track.duration);
  const sourceUrl = isHttpUrl(track.path) ? track.path : null;
  const stateLabel = state.playbackState[0].toUpperCase() + state.playbackState.slice(1);

  const embed = new EmbedBuilder()
    .setTitle(title ?? 'Unknown track')
    .addFields(
      { name: 'Progress', value: `\`[${bar}]\` ${pos} / ${dur}` },
      { name: 'State', value: stateLabel, inline: true },
      { name: 'Backend', value: ctx.player.name, inline: true },
    )
    .setColor(state.playbackState === 'playing' ? 0x1db954 : 0xf1c40f)
    .setFooter({ text: `Track ${track.trackIndex + 1}` });

  if (sourceUrl) embed.setURL(sourceUrl);
  if (artists) embed.setDescription(artists);
  if (album) embed.addFields({ name: 'Album', value: album, inline: true });
  if (sourceUrl) embed.addFields({ name: 'Source', value: `[Open stream](${sourceUrl})`, inline: true });

  const files: AttachmentBuilder[] = [];
  if (stored?.albumArtUrl) {
    embed.setThumbnail(stored.albumArtUrl);
  } else if (!sourceUrl) {
    try {
      const playlistId = state.activeItem?.playlistId ?? 'p1';
      const artRes = await fetch(
        `${CONFIG.BEEFWEB_BASE_URL}/api/artwork/${playlistId}/${track.trackIndex}`,
        { signal: AbortSignal.timeout(3000) },
      );
      if (artRes.ok) {
        const buf = Buffer.from(await artRes.arrayBuffer());
        files.push(new AttachmentBuilder(buf, { name: 'cover.jpg' }));
        embed.setThumbnail('attachment://cover.jpg');
      }
    } catch { /* no artwork available */ }
  }

  await message.reply({ embeds: [embed], files });
};
