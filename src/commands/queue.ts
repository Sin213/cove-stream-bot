import type { CommandHandler } from '../discord/commands.js';
import { replyAndDelete } from '../discord/commands.js';
import { getTrackMeta, pruneTrackMeta } from '../monochrome/trackMeta.js';
import { getQueueEntries } from '../queue/store.js';

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function isUrl(s: string): boolean {
  return s.startsWith('http') || s.includes('://') || (s.includes('?') && s.includes('='));
}

function cleanLabel(raw: string, fallback: string): string {
  return raw && raw !== 'Unknown' && !isUrl(raw) ? raw : fallback;
}

export const queueCommand: CommandHandler = async (message, args, ctx) => {
  const state = await ctx.player.getPlayerState();
  const currentIndex = state.activeItem?.index ?? -1;
  const lines: string[] = [];

  if (state.playbackState !== 'stopped' && currentIndex >= 0) {
    const cols = state.activeItem.columns;
    const stored = getTrackMeta(currentIndex, cols[3]);
    const artist = stored ? (stored.artists[0] ?? '') : cleanLabel(cols[0], '');
    const title = stored ? stored.title : cleanLabel(cols[1], '');
    const pos = fmt(state.activeItem.position);
    const dur = fmt(state.activeItem.duration);
    const icon = state.playbackState === 'paused' ? '⏸' : '▶';
    const label = title && artist ? `**${title}** — ${artist}` : title ? `**${title}**` : '';
    lines.push(`${icon}${label ? ` ${label}` : ''} [${pos}/${dur}]`);
    pruneTrackMeta(currentIndex);
  } else {
    lines.push('Nothing playing.');
  }

  const entries = getQueueEntries();

  if (entries.length > 0) {
    lines.push('');
    entries.slice(0, 10).forEach((entry, i) => {
      const artist = entry.artists[0] ?? '';
      const label = entry.title && artist ? `${entry.title} — ${artist}` : entry.title || artist || '';
      lines.push(`**${i + 1}.** ${label}`);
    });
    if (entries.length > 10) {
      lines.push(`*…and ${entries.length - 10} more*`);
    }
  } else {
    lines.push('Queue is empty.');
  }

  await replyAndDelete(message, lines.join('\n'), 5000);
};
