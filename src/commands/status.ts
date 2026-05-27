import type { CommandHandler } from '../discord/commands.js';
import { reply } from '../discord/commands.js';

export const statusCommand: CommandHandler = async (message, _args, ctx) => {
  const state = await ctx.beefweb.getPlayerState();
  const track = await ctx.beefweb.getCurrentTrack();
  const relayRunning = ctx.relayManager.isRunning();
  const connected = ctx.voiceManager.isConnected();

  const lines = [
    `Relay: ${relayRunning ? 'Running' : 'Stopped'}`,
    `Voice: ${connected ? 'Connected' : 'Disconnected'}`,
    `Player: ${state.playbackState}`,
  ];

  if (track) {
    lines.push(`Track: ${track.title} — ${track.artist}`);
  }

  await reply(message, lines.join('\n'));
};
