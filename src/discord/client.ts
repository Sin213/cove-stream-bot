import { Client, GatewayIntentBits, ActivityType, Partials } from 'discord.js';

export function createDiscordClient(): Client {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMessageReactions,
    ],
    // Without these, reaction events on messages that aren't in the cache
    // (e.g. an older vote-skip message) are silently dropped.
    partials: [Partials.Message, Partials.Channel, Partials.Reaction],
  });

  client.once('ready', () => {
    console.log(`Bot logged in as ${client.user?.tag}`);
    client.user?.setPresence({
      activities: [{ name: 'music', type: ActivityType.Listening }],
      status: 'online',
    });
  });

  return client;
}
