import type { CommandHandler } from '../discord/commands.js';
import { reply, replyAndDelete } from '../discord/commands.js';
import { getSearchResult, consumeSearchMessage } from '../monochrome/selection.js';
import { setTrackMeta } from '../monochrome/trackMeta.js';
import { appendToQueue, getQueueEntries } from '../queue/store.js';
import { isStreamingLink, resolveStreamingLink } from '../resolve/links.js';
import type { TrackMatch } from '../monochrome/types.js';
import { getLocalResult, consumeLocalMessage } from './local.js';

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
      ctx.player.getPlaylists(),
      ctx.player.getPlayerState(),
    ]);
    const playlist = playlists.find(p => p.isCurrent) ?? playlists[0];
    if (!playlist) throw new Error('No playlists exist in the player');
    const isPlaying = state.playbackState === 'playing';
    const currentIndex = state.activeItem?.index ?? -1;
    const insertIndex = isPlaying ? currentIndex + 1 + getQueueEntries().length : playlist.itemCount;
    await ctx.player.addItems(playlist.id, [url], { play: !isPlaying, index: insertIndex });
    setTrackMeta(insertIndex, url, {
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
    if (isPlaying) {
      await replyAndDelete(message, `${label}: ${result.title} — ${artist}`, 3000);
    } else {
      await reply(message, `${label}: ${result.title} — ${artist}`);
    }
  } catch (err) {
    await reply(message, `Failed to queue track: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export const playCommand: CommandHandler = async (message, args, ctx) => {
  // Detect streaming links (Spotify / Apple Music)
  if (args.length > 0 && isStreamingLink(args[0])) {
    if (!ctx.monochrome.enabled) {
      await reply(message, 'Online search is disabled. Use `!monochrome on` to re-enable.');
      return;
    }
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
    // Check local results first, then online search results
    const local = getLocalResult(message.userId, num);
    if (local) {
      consumeLocalMessage(message.userId)?.delete().catch(() => {});
      try {
        const [playlists, state] = await Promise.all([
          ctx.player.getPlaylists(),
          ctx.player.getPlayerState(),
        ]);
        const playlist = playlists.find(p => p.isCurrent) ?? playlists[0];
        if (!playlist) throw new Error('No playlists exist in the player');
        const isPlaying = state.playbackState === 'playing';
        const currentIndex = state.activeItem?.index ?? -1;
        const targetIndex = isPlaying ? currentIndex + 1 + getQueueEntries().length : playlist.itemCount;
        await ctx.player.copyItems(local.playlistId, [local.index], targetIndex);
        setTrackMeta(targetIndex, local.path, {
          title: local.title,
          artists: [local.artist],
        });
        if (!isPlaying) {
          await ctx.player.playItem(playlist.id, targetIndex);
        }
        if (isPlaying) {
          appendToQueue({ title: local.title, artists: [local.artist], local: true });
        }
        const label = isPlaying ? '⏭ Queued' : '▶ Playing';
        if (isPlaying) {
          await replyAndDelete(message, `${label}: ${local.title} — ${local.artist}`, 3000);
        } else {
          await reply(message, `${label}: ${local.title} — ${local.artist}`);
        }
      } catch (err) {
        await reply(message, `Failed to queue local track: ${err instanceof Error ? err.message : String(err)}`);
      }
      return;
    }

    const result = getSearchResult(message.userId, num);
    if (!result) {
      await reply(message, 'No search results found. Run `!search <query>` or `!local <query>` first.');
      return;
    }
    consumeSearchMessage(message.userId)?.delete().catch(() => {});
    await queueTrack(message, ctx, result);
    return;
  }

  const state = await ctx.player.getPlayerState();
  if (state.playbackState === 'playing') {
    await reply(message, 'Already playing.');
    return;
  }
  if (state.playbackState === 'paused') {
    await ctx.player.pauseToggle();
    await reply(message, 'Playback resumed.');
    return;
  }
  await ctx.player.play();
  await reply(message, 'Playback started.');
};
