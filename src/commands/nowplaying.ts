import type { CommandHandler } from '../discord/commands.js';
import { reply, replyAndDelete } from '../discord/commands.js';
import { AttachmentBuilder, EmbedBuilder } from 'discord.js';
import { getTrackMeta } from '../monochrome/trackMeta.js';
import type { TrackMeta } from '../monochrome/trackMeta.js';
import type { PlayerState, TrackInfo } from '../player/types.js';
import { CONFIG } from '../config.js';
import { displayValue, formatDuration } from '../util/text.js';

function progressBar(position: number, duration: number, width = 16): string {
  const ratio = duration > 0 ? Math.max(0, Math.min(1, position / duration)) : 0;
  const filled = Math.round(ratio * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function isHttpUrl(value: string): boolean {
  return value.startsWith('http://') || value.startsWith('https://');
}

/**
 * Builds the rich now-playing card (title, artist, progress, state, backend,
 * source, album art) shared by the `!np` command and the autonp announcement.
 * Album art comes from stored metadata, or is fetched from beefweb's embedded
 * artwork and attached (for local / downloaded tracks with no public art URL).
 */
export async function buildTrackEmbed(
  state: PlayerState,
  track: TrackInfo,
  stored: TrackMeta | undefined,
  playerName: string,
  footerText: string,
): Promise<{ embed: EmbedBuilder; files: AttachmentBuilder[] }> {
  const rawTitle = displayValue(track.title);
  const rawArtist = displayValue(track.artist);
  const album = displayValue(track.album);
  const title = stored?.title || rawTitle || null;
  const artists = stored?.artists?.length ? stored.artists.join(', ') : rawArtist;
  const bar = progressBar(track.position, track.duration);
  const pos = formatDuration(track.position);
  const dur = formatDuration(track.duration);
  // Online tracks play from a local cache file, so prefer the stored web URL.
  const sourceUrl = stored?.sourceUrl ?? (isHttpUrl(track.path) ? track.path : null);
  const sourceLabel = sourceUrl?.includes('tidal') ? 'Listen on TIDAL' : 'Open stream';
  const stateLabel = state.playbackState[0].toUpperCase() + state.playbackState.slice(1);

  const embed = new EmbedBuilder()
    .setTitle(title ?? 'Unknown track')
    .addFields(
      { name: 'Progress', value: `\`[${bar}]\` ${pos} / ${dur}` },
      { name: 'State', value: stateLabel, inline: true },
      { name: 'Backend', value: playerName, inline: true },
    )
    .setColor(state.playbackState === 'playing' ? 0x1db954 : 0xf1c40f)
    .setFooter({ text: footerText });

  if (sourceUrl) embed.setURL(sourceUrl);
  if (artists) embed.setDescription(artists);
  if (album) embed.addFields({ name: 'Album', value: album, inline: true });
  if (sourceUrl) embed.addFields({ name: 'Source', value: `[${sourceLabel}](${sourceUrl})`, inline: true });

  const files: AttachmentBuilder[] = [];
  if (stored?.albumArtUrl) {
    embed.setThumbnail(stored.albumArtUrl);
  } else {
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

  return { embed, files };
}

export const nowplayingCommand: CommandHandler = async (message, _args, ctx) => {
  const [state, track] = await Promise.all([
    ctx.player.getPlayerState(),
    ctx.player.getCurrentTrack(),
  ]);
  if (!track) {
    await replyAndDelete(message, 'Nothing is currently playing.', 5000);
    return;
  }

  const stored = getTrackMeta(track.trackIndex, track.path);
  const { embed, files } = await buildTrackEmbed(state, track, stored, ctx.player.name, `Track ${track.trackIndex + 1}`);

  // Persistent now-playing panel (no auto-delete).
  await reply(message, { embeds: [embed], files });
};
