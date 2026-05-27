import { Events } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { CONFIG } from './config.js';
import { createDiscordClient } from './discord/client.js';
import { registerCommand, getCommand } from './discord/commands.js';
import type { Responder } from './discord/commands.js';
import { registerSlashCommands } from './discord/slashCommands.js';
import { BeefwebClient } from './beefweb/client.js';
import { RelayManager } from './voice/relay.js';
import { VoiceConnectionManager } from './voice/connection.js';
import { startPresenceSync } from './presence/sync.js';
import { MonochromeClient } from './monochrome/client.js';

import { joinCommand } from './commands/join.js';
import { leaveCommand } from './commands/leave.js';
import { relayCommand } from './commands/relay.js';
import { playCommand } from './commands/play.js';
import { pauseCommand } from './commands/pause.js';
import { nextCommand } from './commands/next.js';
import { prevCommand } from './commands/prev.js';
import { stopCommand } from './commands/stop.js';
import { nowplayingCommand } from './commands/nowplaying.js';
import { statusCommand } from './commands/status.js';
import { searchCommand } from './commands/search.js';
import { queueCommand } from './commands/queue.js';
import { removeCommand } from './commands/remove.js';
import { restartCommand } from './commands/restart.js';
import { autonpCommand } from './commands/autonp.js';
import { clearQueueCommand } from './commands/clearqueue.js';
import { whitelistCommand } from './commands/whitelist.js';
import { blacklistCommand } from './commands/blacklist.js';
import { getAnnounceChannel } from './autonp/state.js';

registerCommand('join', joinCommand);
registerCommand('leave', leaveCommand);
registerCommand('relay', relayCommand);
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

const PREFIX = '!';

const PROTECTED_COMMANDS = new Set([
  'join', 'leave', 'relay', 'play', 'pause', 'next', 'skip', 'prev', 'stop', 'remove', 'rm',
  'clearqueue', 'cq', 'whitelist', 'wl', 'blacklist', 'bl',
]);

const handledMessageIds = new Set<string>();

function slashArgs(interaction: ChatInputCommandInteraction): string[] {
  switch (interaction.commandName) {
    case 'play': {
      const n = interaction.options.getInteger('number');
      return n !== null ? [String(n)] : [];
    }
    case 'search':
      return [interaction.options.getString('query', true)];
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
  const beefweb = new BeefwebClient(CONFIG.BEEFWEB_BASE_URL);
  const monochrome = new MonochromeClient(CONFIG.MONOCHROME_API_BASE_URLS, CONFIG.MONOCHROME_QUALITY, CONFIG.QOBUZ_BASE_URLS);
  const relayManager = new RelayManager();
  const voiceManager = new VoiceConnectionManager();

  try {
    await beefweb.getPlayerState();
    console.log('Beefweb connection OK');
  } catch {
    console.warn('Could not reach Beefweb — is DeaDBeeF running with the plugin?');
  }

  if (CONFIG.WEB_UI_ENABLED) {
    const { startWebServer } = await import('./web/server.js');
    startWebServer(beefweb, relayManager, CONFIG.WEB_UI_PORT);
  }

  // Prefix commands (!play, !search, etc.)
  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith(PREFIX)) return;
    if (handledMessageIds.has(message.id)) return;
    handledMessageIds.add(message.id);
    if (handledMessageIds.size > 1000) {
      const first = handledMessageIds.values().next().value;
      if (first !== undefined) handledMessageIds.delete(first);
    }

    const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
    const commandName = args.shift()?.toLowerCase() ?? '';

    const handler = getCommand(commandName);
    if (!handler) return;

    if (CONFIG.BLACKLISTED_USER_IDS.has(message.author.id)) return;

    if (
      PROTECTED_COMMANDS.has(commandName) &&
      CONFIG.APPROVED_USER_IDS.size > 0 &&
      !CONFIG.APPROVED_USER_IDS.has(message.author.id)
    ) {
      try {
        await message.reply('You are not authorized to use this command.');
      } catch { /* channel gone */ }
      return;
    }

    const responder: Responder = {
      userId: message.author.id,
      channel: message.channel as Responder['channel'],
      member: message.member as Responder['member'],
      reply: async (content) => {
        if ('send' in message.channel) await (message.channel as any).send(content);
      },
    };

    const ctx = { beefweb, monochrome, relayManager, voiceManager };

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

    if (CONFIG.BLACKLISTED_USER_IDS.has(interaction.user.id)) {
      await interaction.reply({ content: 'You are not authorized to use this command.', ephemeral: true });
      return;
    }

    if (
      PROTECTED_COMMANDS.has(interaction.commandName) &&
      CONFIG.APPROVED_USER_IDS.size > 0 &&
      !CONFIG.APPROVED_USER_IDS.has(interaction.user.id)
    ) {
      await interaction.reply({ content: 'You are not authorized to use this command.', ephemeral: true });
      return;
    }

    await interaction.deferReply();

    const responder: Responder = {
      userId: interaction.user.id,
      channel: interaction.channel as Responder['channel'],
      member: interaction.member as Responder['member'],
      reply: async (content) => { await interaction.editReply(content); },
    };

    const ctx = { beefweb, monochrome, relayManager, voiceManager };

    try {
      await handler(responder, slashArgs(interaction), ctx);
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

  startPresenceSync(client, beefweb, (title, artist) => {
    const text = artist ? `▶ **${title}** — ${artist}` : `▶ **${title}**`;

    const ch = getAnnounceChannel();
    if (ch) ch.send(text).catch(() => { /* channel gone */ });

    const channelId = voiceManager.connection?.joinConfig.channelId;
    if (channelId) {
      const status = artist ? `${title} — ${artist}` : title;
      client.rest.put(`/channels/${channelId}/voice-status`, { body: { status } })
        .catch(() => { /* non-critical */ });
    }
  });
  console.log('Bot is running');

  const shutdown = () => {
    voiceManager.leave();
    void client.destroy().then(() => process.exit(0)).catch(() => process.exit(0));
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

main().catch(console.error);
