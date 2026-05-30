import { Events, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { CONFIG } from './config.js';
import { createDiscordClient } from './discord/client.js';
import { registerCommand, getCommand } from './discord/commands.js';
import type { Responder } from './discord/commands.js';
import { registerSlashCommands } from './discord/slashCommands.js';
import { createPlayerBackend } from './player/factory.js';
import { startPresenceSync } from './presence/sync.js';
import { MonochromeClient } from './monochrome/client.js';
import { getGuildState, getAllGuildStates, GuildState } from './guild/state.js';
import { getTrackMeta } from './monochrome/trackMeta.js';
import { restoreQueue } from './queue/store.js';
import { checkRateLimit } from './security/ratelimit.js';
import { auditLog } from './security/audit.js';

import { joinCommand } from './commands/join.js';
import { leaveCommand } from './commands/leave.js';
import { playCommand } from './commands/play.js';
import { pauseCommand } from './commands/pause.js';
import { nextCommand } from './commands/next.js';
import { prevCommand } from './commands/prev.js';
import { stopCommand } from './commands/stop.js';
import { nowplayingCommand, buildTrackEmbed } from './commands/nowplaying.js';
import { statusCommand } from './commands/status.js';
import { searchCommand } from './commands/search.js';
import { queueCommand } from './commands/queue.js';
import { removeCommand } from './commands/remove.js';
import { restartCommand } from './commands/restart.js';
import { autonpCommand } from './commands/autonp.js';
import { clearQueueCommand } from './commands/clearqueue.js';
import { whitelistCommand } from './commands/whitelist.js';
import { blacklistCommand } from './commands/blacklist.js';
import { shuffleCommand } from './commands/shuffle.js';
import { historyCommand } from './commands/history.js';
import { mirrorsCommand } from './commands/mirrors.js';
import { voteskipCommand } from './commands/voteskip.js';
import { autosearchCommand } from './commands/autosearch.js';
import { localCommand } from './commands/local.js';
import { monochromeCommand } from './commands/monochrome.js';

registerCommand('join', joinCommand);
registerCommand('leave', leaveCommand);
registerCommand('relay', joinCommand);
registerCommand('play', playCommand);
registerCommand('pause', pauseCommand);
registerCommand('next', nextCommand);
registerCommand('skip', nextCommand);
registerCommand('prev', prevCommand);
registerCommand('stop', stopCommand);
registerCommand('np', nowplayingCommand);
registerCommand('nowplaying', nowplayingCommand);
registerCommand('status', statusCommand);
registerCommand('search', searchCommand);
registerCommand('queue', queueCommand);
registerCommand('q', queueCommand);
registerCommand('remove', removeCommand);
registerCommand('rm', removeCommand);
registerCommand('restart', restartCommand);
registerCommand('autonp', autonpCommand);
registerCommand('clearqueue', clearQueueCommand);
registerCommand('cq', clearQueueCommand);
registerCommand('whitelist', whitelistCommand);
registerCommand('wl', whitelistCommand);
registerCommand('blacklist', blacklistCommand);
registerCommand('bl', blacklistCommand);
registerCommand('shuffle', shuffleCommand);
registerCommand('history', historyCommand);
registerCommand('mirrors', mirrorsCommand);
registerCommand('voteskip', voteskipCommand);
registerCommand('vs', voteskipCommand);
registerCommand('autosearch', autosearchCommand);
registerCommand('as', autosearchCommand);
registerCommand('local', localCommand);
registerCommand('monochrome', monochromeCommand);

const PREFIX = '!';

const PROTECTED_COMMANDS = new Set([
  'join', 'leave', 'relay', 'play', 'pause', 'next', 'skip', 'prev', 'stop', 'remove', 'rm',
  'clearqueue', 'cq', 'whitelist', 'wl', 'blacklist', 'bl', 'shuffle', 'restart', 'autosearch', 'as',
]);

// Bounded set of recently-handled message IDs to guard against double-dispatch.
// Insertion-ordered, so evicting the oldest entry is O(1) on the hot path.
const handledMessageIds = new Set<string>();
const MAX_HANDLED_IDS = 1000;

type AuthDecision =
  | { ok: true }
  | { ok: false; kind: 'blacklisted' }
  | { ok: false; kind: 'unauthorized' | 'ratelimited'; message: string };

// Shared gating for prefix and slash commands: blacklist → protected → rate limit.
// Callers decide how to surface a denial (prefix is silent on blacklist; slash
// always replies ephemerally). checkRateLimit records usage, so call exactly once.
function authorize(commandName: string, guildState: GuildState, userId: string): AuthDecision {
  if (guildState.blacklistedUserIds.has(userId)) return { ok: false, kind: 'blacklisted' };
  if (
    PROTECTED_COMMANDS.has(commandName) &&
    guildState.approvedUserIds.size > 0 &&
    !guildState.approvedUserIds.has(userId)
  ) {
    return { ok: false, kind: 'unauthorized', message: 'You are not authorized to use this command.' };
  }
  const rl = checkRateLimit(guildState.guildId, userId, commandName);
  if (!rl.allowed) return { ok: false, kind: 'ratelimited', message: rl.reason! };
  return { ok: true };
}

function slashArgs(interaction: ChatInputCommandInteraction): string[] {
  switch (interaction.commandName) {
    case 'play': {
      const n = interaction.options.getInteger('number');
      return n !== null ? [String(n)] : [];
    }
    case 'search':
    case 'autosearch':
    case 'local':
      return [interaction.options.getString('query', true)];
    case 'monochrome': {
      const action = interaction.options.getString('action');
      return action ? [action] : [];
    }
    case 'remove':
      return [String(interaction.options.getInteger('position', true))];
    case 'whitelist':
    case 'blacklist': {
      const action = interaction.options.getString('action', true);
      const user = interaction.options.getUser('user');
      return user ? [action, user.id] : [action];
    }
    default:
      return [];
  }
}

async function main() {
  const client = createDiscordClient();
  const player = createPlayerBackend();
  const monochrome = new MonochromeClient(CONFIG.MONOCHROME_API_BASE_URLS, CONFIG.MONOCHROME_QUALITY, CONFIG.QOBUZ_BASE_URLS);

  try {
    await player.getPlayerState();
    console.log(`${player.name} connection OK`);
    restoreQueue(player, monochrome).catch(console.error);
  } catch {
    console.warn(`Could not reach ${player.name} — is the player running with its remote-control plugin?`);
  }

  if (CONFIG.WEB_UI_ENABLED) {
    // Use the default guild's relayManager for the web UI
    const defaultGuildState = getGuildState(CONFIG.GUILD_ID);
    const { startWebServer } = await import('./web/server.js');
    startWebServer(player, defaultGuildState.relayManager, CONFIG.WEB_UI_PORT);
  }

  // Prefix commands (!play, !search, etc.)
  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith(PREFIX)) return;
    if (handledMessageIds.has(message.id)) return;
    handledMessageIds.add(message.id);
    if (handledMessageIds.size > MAX_HANDLED_IDS) {
      const oldest = handledMessageIds.values().next().value;
      if (oldest !== undefined) handledMessageIds.delete(oldest);
    }

    const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
    const commandName = args.shift()?.toLowerCase() ?? '';

    const handler = getCommand(commandName);
    if (!handler) return;

    const guildId = message.guildId ?? '';
    const guildState = getGuildState(guildId);

    const decision = authorize(commandName, guildState, message.author.id);
    if (!decision.ok) {
      // Prefix path stays silent for blacklisted users (no reply).
      if (decision.kind !== 'blacklisted') {
        try { await message.reply(decision.message); } catch { /* channel gone */ }
      }
      return;
    }

    auditLog(guildId, message.author.id, commandName, args);

    const responder: Responder = {
      userId: message.author.id,
      guildId: message.guildId,
      channel: message.channel as Responder['channel'],
      member: message.member as Responder['member'],
      reply: async (content) => {
        if ('send' in message.channel) return await (message.channel as any).send(content);
        return undefined;
      },
    };

    const ctx = {
      player,
      monochrome,
      relayManager: guildState.relayManager,
      voiceManager: guildState.voiceManager,
      guildState,
    };

    try {
      await handler(responder, args, ctx);
    } catch (err) {
      console.error(`Command error (${commandName}):`, err);
      try {
        await (message.channel as any).send('Command failed. Check console for details.');
      } catch { /* channel gone */ }
    }
  });

  // Slash commands (/play, /search, etc.)
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const handler = getCommand(interaction.commandName);
    if (!handler) return;

    const guildId = interaction.guildId ?? '';
    const guildState = getGuildState(guildId);

    const decision = authorize(interaction.commandName, guildState, interaction.user.id);
    if (!decision.ok) {
      const content = decision.kind === 'blacklisted'
        ? 'You are not authorized to use this command.'
        : decision.message;
      await interaction.reply({ content, ephemeral: true });
      return;
    }

    const sArgs = slashArgs(interaction);
    auditLog(guildId, interaction.user.id, interaction.commandName, sArgs);

    const ephemeral = interaction.commandName === 'search';
    await interaction.deferReply({ ephemeral });

    const responder: Responder = {
      userId: interaction.user.id,
      guildId: interaction.guildId,
      channel: interaction.channel as Responder['channel'],
      member: interaction.member as Responder['member'],
      reply: async (content) => await interaction.editReply(content as any),
    };

    const ctx = {
      player,
      monochrome,
      relayManager: guildState.relayManager,
      voiceManager: guildState.voiceManager,
      guildState,
    };

    try {
      await handler(responder, sArgs, ctx);
    } catch (err) {
      console.error(`Slash command error (${interaction.commandName}):`, err);
      try {
        await interaction.editReply('Command failed. Check console for details.');
      } catch { /* interaction expired */ }
    }
  });

  await client.login(CONFIG.DISCORD_TOKEN);

  // Register slash commands with this guild
  const appId = client.application?.id ?? client.user!.id;
  registerSlashCommands(CONFIG.DISCORD_TOKEN, appId, CONFIG.GUILD_ID).catch(console.error);

  const presenceTimer = startPresenceSync(client, player, async (title, artist, meta) => {
    // Build the rich now-playing card for the autonp announcement — same format
    // as the !np command (progress/state/backend/source/art) — for local + online.
    let embed: EmbedBuilder | null = null;
    let artFiles: AttachmentBuilder[] = [];
    if (title) {
      try {
        const [state, track] = await Promise.all([player.getPlayerState(), player.getCurrentTrack()]);
        if (track) {
          const stored = getTrackMeta(track.trackIndex, track.path) ?? meta ?? undefined;
          const built = await buildTrackEmbed(state, track, stored, player.name, '▶ Now Playing');
          embed = built.embed;
          artFiles = built.files;
        }
      } catch { /* backend hiccup — skip this announcement */ }
    }

    for (const gs of getAllGuildStates()) {
      // Reset vote-skip on track change, then (re)announce for this guild.
      gs.voteSkipMessageId = null;

      // Autonp announcement
      if (gs.announceChannelId && embed) {
        try {
          const ch = client.channels.cache.get(gs.announceChannelId);
          if (ch && 'send' in ch && typeof (ch as any).send === 'function') {
            const msg = await (ch as any).send({ embeds: [embed], files: artFiles }) as { id: string; react(e: string): Promise<unknown> };
            gs.voteSkipMessageId = msg.id;
            await msg.react('⏭');
          }
        } catch { /* channel gone */ }
      }

      // VC status — always update, clear when no metadata
      const vcChannelId = gs.voiceManager.connection?.joinConfig.channelId;
      if (vcChannelId) {
        const status = title && artist ? `${title} — ${artist}` : title || '';
        client.rest.put(`/channels/${vcChannelId}/voice-status`, { body: { status } })
          .catch(() => { /* non-critical */ });
      }
    }
  });

  // Vote-skip: majority of VC members reacting ⏭ on the autonp message skips the track
  client.on(Events.MessageReactionAdd, async (reaction, user) => {
    if (user.bot) return;
    // Partials may arrive for uncached messages — hydrate before reading fields.
    if (reaction.partial) {
      try { await reaction.fetch(); } catch { return; }
    }
    if (reaction.emoji.name !== '⏭') return;

    // Find which guild owns this vote-skip message
    const guildStates = getAllGuildStates();
    const gs = guildStates.find(s => s.voteSkipMessageId === reaction.message.id);
    if (!gs) return;

    const vcChannelId = gs.voiceManager.connection?.joinConfig.channelId;
    if (!vcChannelId) return;

    const vcChannel = client.channels.cache.get(vcChannelId);
    if (!vcChannel || !('members' in vcChannel)) return;

    const members = (vcChannel as any).members as Map<string, { user: { bot: boolean } }>;
    const eligible = [...members.values()].filter(m => !m.user.bot).length;
    if (eligible === 0) return;

    const votes = (reaction.count ?? 1) - 1;

    if (votes * 2 > eligible) {
      gs.voteSkipMessageId = null;
      await player.next().catch(() => {});
      try {
        await (reaction.message.channel as any).send('The people have spoken! Skipped!');
      } catch { /* channel gone */ }
    }
  });
  console.log('Bot is running');

  const shutdown = () => {
    clearInterval(presenceTimer);
    for (const gs of getAllGuildStates()) {
      gs.voiceManager.leave();
    }
    void client.destroy().then(() => process.exit(0)).catch(() => process.exit(0));
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

// Keep the bot alive on stray async errors (e.g. a transient Discord/network
// rejection) instead of crashing the whole process.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

main().catch(console.error);
