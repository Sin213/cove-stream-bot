import type { CommandHandler } from '../discord/commands.js';
import { EmbedBuilder } from 'discord.js';
import { getTrackMeta } from '../monochrome/trackMeta.js';
import { looksLikeUrl } from '../util/text.js';

const VOTE_SKIP_TTL_MS = 5 * 60_000;

export const voteskipCommand: CommandHandler = async (responder, _args, ctx) => {
  const track = await ctx.player.getCurrentTrack();
  if (!track) {
    await responder.reply('Nothing is currently playing.');
    return;
  }

  const stored = getTrackMeta(track.trackIndex, track.path);

  const rawTitle = track.title !== 'Unknown' && !looksLikeUrl(track.title) ? track.title : null;
  const rawArtist = track.artist !== 'Unknown' && !looksLikeUrl(track.artist) ? track.artist : null;
  const title = stored?.title || rawTitle || null;
  const artist = stored?.artists[0] || rawArtist || null;

  const embed = new EmbedBuilder()
    .setColor(0x1db954)
    .setFooter({ text: '⏭ React to vote skip' });

  if (title) embed.setTitle(title);
  if (artist) embed.setDescription(artist);
  if (stored?.albumArtUrl) embed.setThumbnail(stored.albumArtUrl);

  const ch = responder.channel;
  if (!ch || !('send' in ch)) {
    await responder.reply('Cannot send message in this channel.');
    return;
  }

  const msg = await (ch as any).send({ embeds: [embed] }) as { id: string; react(e: string): Promise<unknown> };
  const { guildState } = ctx;
  guildState.voteSkipMessageId = msg.id;
  await msg.react('⏭');

  // Expire the vote if it's never resolved, so a stale message ID can't linger
  // until the next track change.
  setTimeout(() => {
    if (guildState.voteSkipMessageId === msg.id) guildState.voteSkipMessageId = null;
  }, VOTE_SKIP_TTL_MS);
};
