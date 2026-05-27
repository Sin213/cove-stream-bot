import type { CommandHandler } from '../discord/commands.js';
import { reply } from '../discord/commands.js';
import { getSearchResult, consumeSearchMessage } from '../monochrome/selection.js';
import { setTrackMeta } from '../monochrome/trackMeta.js';
import { appendToQueue } from '../queue/store.js';
import { isStreamingLink, resolveStreamingLink } from '../resolve/links.js';
import type { TrackMatch } from '../monochrome/types.js';

function formatStreamError(reason: string | undefined, primary: string | undefined): string {
  switch (reason) {
    case 'PREVIEW_ONLY':
      return "Couldn't stream that track — TIDAL only returned a preview. Try a different quality or track.";
    case 'CREDENTIAL_EXPIRED':
      return "Couldn't stream — worker credentials have expired. Contact the bot owner.";
    case 'REQUIRES_SUBSCRIPTION':
      return "Couldn't stream — track requires a subscription that isn't available. Try again or search for a different version.";
    case 'MANIFEST_ONLY':
      return "Couldn't stream — track is DRM-encrypted and can't be played directly. Try again or search for a different version.";
    default: {
      const detail = primary ? ` (${primary})` : '';
      return `Couldn't reach any stream mirrors${detail}. Try again in a moment.`;
    }
  }
}

export async function queueTrack(
  message: Parameters<CommandHandler>[0],
  ctx: Parameters<CommandHandler>[2],
  result: TrackMatch,
): Promise<void> {
  let url: string;
  try {
    url = await ctx.monochrome.getStreamUrl(result.tidalId, undefined, result.isrc);
  } catch (err) {
    const reason = (err as any)?.reason as string | undefined;
    const primary = (err as any)?.primaryFailure as string | undefined;
    await reply(message, formatStreamError(reason, primary));
    return;
  }

  try {
    const [playlists, state] = await Promise.all([
      ctx.beefweb.getPlaylists(),
      ctx.beefweb.getPlayerState(),
    ]);
    const playlist = playlists.find(p => p.isCurrent) ?? playlists[0];
    if (!playlist) throw new Error('No playlists exist in the player');
    const isPlaying = state.playbackState === 'playing';
    const newIndex = playlist.itemCount;
    await ctx.beefweb.addItems(playlist.id, [url], { play: !isPlaying });
    setTrackMeta(newIndex, url, {
      title: result.title,
      artists: result.artists,
      isrc: result.isrc,
      albumArtUrl: result.albumArtUrl,
    });
    if (isPlaying) {
      appendToQueue({ tidalId: result.tidalId, isrc: result.isrc, title: result.title, artists: result.artists });
    }
    const artist = result.artists[0] ?? 'Unknown';
    const label = isPlaying ? '⏭ Queued' : '▶ Playing';
    await reply(message, `${label}: ${result.title} — ${artist}`);
  } catch (err) {
    await reply(message, `Failed to queue track: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export const playCommand: CommandHandler = async (message, args, ctx) => {
  // Detect streaming links (Spotify / Apple Music)
  if (args.length > 0 && isStreamingLink(args[0])) {
    let resolved: TrackMatch | null = null;
    try {
      resolved = await resolveStreamingLink(args[0], ctx.monochrome);
    } catch { /* fall through */ }
    if (!resolved) {
      await reply(message, 'Could not resolve that link. Try searching with `!search` instead.');
      return;
    }
    await queueTrack(message, ctx, resolved);
    return;
  }

  const num = args.length > 0 ? parseInt(args[0], 10) : NaN;

  if (Number.isInteger(num) && num > 0) {
    const result = getSearchResult(message.userId, num);
    if (!result) {
      await reply(message, 'No search results found. Run `!search <query>` first.');
      return;
    }
    consumeSearchMessage(message.userId)?.delete().catch(() => {});
    await queueTrack(message, ctx, result);
    return;
  }

  const state = await ctx.beefweb.getPlayerState();
  if (state.playbackState === 'playing') {
    await reply(message, 'Already playing.');
    return;
  }
  if (state.playbackState === 'paused') {
    await ctx.beefweb.pauseToggle();
    await reply(message, 'Playback resumed.');
    return;
  }
  await ctx.beefweb.play();
  await reply(message, 'Playback started.');
};
