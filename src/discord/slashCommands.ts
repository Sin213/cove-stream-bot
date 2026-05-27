import { SlashCommandBuilder, REST, Routes } from 'discord.js';

const definitions = [
  new SlashCommandBuilder().setName('join').setDescription('Join your voice channel'),
  new SlashCommandBuilder().setName('leave').setDescription('Leave the voice channel'),
  new SlashCommandBuilder().setName('relay').setDescription('Start relaying player audio to the voice channel'),
  new SlashCommandBuilder().setName('play').setDescription('Play a search result or resume playback')
    .addIntegerOption(o => o.setName('number').setDescription('Search result number').setRequired(false).setMinValue(1)),
  new SlashCommandBuilder().setName('pause').setDescription('Pause or resume playback'),
  new SlashCommandBuilder().setName('next').setDescription('Skip to the next track'),
  new SlashCommandBuilder().setName('prev').setDescription('Go to the previous track'),
  new SlashCommandBuilder().setName('stop').setDescription('Stop playback'),
  new SlashCommandBuilder().setName('np').setDescription('Show what is currently playing'),
  new SlashCommandBuilder().setName('search').setDescription('Search for a track')
    .addStringOption(o => o.setName('query').setDescription('Artist, title, or album').setRequired(true)),
  new SlashCommandBuilder().setName('queue').setDescription('Show the current queue'),
  new SlashCommandBuilder().setName('remove').setDescription('Remove a track from the queue')
    .addIntegerOption(o => o.setName('position').setDescription('Queue position (1 = next up)').setRequired(true).setMinValue(1)),
  new SlashCommandBuilder().setName('restart').setDescription('Restart the current track from the beginning'),
  new SlashCommandBuilder().setName('autonp').setDescription('Toggle auto now-playing announcements in this channel'),
  new SlashCommandBuilder().setName('status').setDescription('Show bot and player status'),
  new SlashCommandBuilder().setName('clearqueue').setDescription('Clear upcoming tracks from the queue'),
  new SlashCommandBuilder().setName('blacklist')
    .setDescription('Manage the user blacklist')
    .addStringOption(o =>
      o.setName('action').setDescription('Action to perform').setRequired(true)
        .addChoices(
          { name: 'add', value: 'add' },
          { name: 'remove', value: 'remove' },
          { name: 'list', value: 'list' },
        )
    )
    .addUserOption(o => o.setName('user').setDescription('User to add or remove').setRequired(false)),
  new SlashCommandBuilder().setName('whitelist')
    .setDescription('Manage the user whitelist')
    .addStringOption(o =>
      o.setName('action').setDescription('Action to perform').setRequired(true)
        .addChoices(
          { name: 'add', value: 'add' },
          { name: 'remove', value: 'remove' },
          { name: 'list', value: 'list' },
        )
    )
    .addUserOption(o => o.setName('user').setDescription('User to add or remove').setRequired(false)),
];

export async function registerSlashCommands(token: string, clientId: string, guildId: string): Promise<void> {
  const rest = new REST().setToken(token);
  await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
    body: definitions.map(d => d.toJSON()),
  });
  console.log(`Registered ${definitions.length} slash commands`);
}
