import { Client, GatewayIntentBits, ActivityType } from 'discord.js';

export function createDiscordClient(): Client {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMessageReactions,
    ],
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
