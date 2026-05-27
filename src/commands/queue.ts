import type { CommandHandler } from '../discord/commands.js';
import { reply } from '../discord/commands.js';
import { getTrackMeta, pruneTrackMeta } from '../monochrome/trackMeta.js';

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export const queueCommand: CommandHandler = async (message, args, ctx) => {
  const [state, playlistId] = await Promise.all([
    ctx.beefweb.getPlayerState(),
    ctx.beefweb.getCurrentPlaylistId(),
  ]);

  const currentIndex = state.activeItem?.index ?? -1;
  const lines: string[] = [];

  if (state.playbackState !== 'stopped' && currentIndex >= 0) {
    const cols = state.activeItem.columns;
    const stored = getTrackMeta(currentIndex, cols[3]);
    const artist = stored ? stored.artists[0] ?? 'Unknown' : (cols[0] || 'Unknown');
    const title = stored ? stored.title : (cols[1] || 'Unknown');
    const pos = fmt(state.activeItem.position);
    const dur = fmt(state.activeItem.duration);
    const icon = state.playbackState === 'paused' ? '⏸' : '▶';
    lines.push(`${icon} **${title}** — ${artist} [${pos}/${dur}]`);
    pruneTrackMeta(currentIndex);
  } else {
    lines.push('Nothing playing.');
  }

  const nextOffset = currentIndex >= 0 ? currentIndex + 1 : 0;
  const upcoming = await ctx.beefweb.getPlaylistItems(playlistId, nextOffset, 10);

  if (upcoming.length > 0) {
    lines.push('');
    upcoming.forEach((item, i) => {
      const absoluteIndex = nextOffset + i;
      const cols = item.columns;
      const stored = getTrackMeta(absoluteIndex, cols[3]);
      const artist = stored ? stored.artists[0] ?? 'Unknown' : (cols[0] || 'Unknown');
      const title = stored ? stored.title : (cols[1] || 'Unknown');
      lines.push(`**${i + 1}.** ${title} — ${artist}`);
    });
  } else {
    lines.push('Queue is empty.');
  }

  await reply(message, lines.join('\n'));
};
