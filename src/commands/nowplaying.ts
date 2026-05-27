import type { CommandHandler } from '../discord/commands.js';
import { reply } from '../discord/commands.js';
import { getTrackMeta } from '../monochrome/trackMeta.js';

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export const nowplayingCommand: CommandHandler = async (message, _args, ctx) => {
  const track = await ctx.beefweb.getCurrentTrack();
  if (!track) {
    await reply(message, 'Nothing is currently playing.');
    return;
  }

  const stored = getTrackMeta(track.trackIndex, track.path);
  const title = stored?.title || track.title;
  const artist = stored?.artists[0] || track.artist;

  await reply(message,
    `**${title}** — ${artist}\n${formatDuration(track.position)} / ${formatDuration(track.duration)}`
  );
};
