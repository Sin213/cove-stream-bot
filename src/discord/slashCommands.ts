import { SlashCommandBuilder, REST, Routes } from 'discord.js';
import { createHash } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const HASH_PATH = resolve(process.cwd(), 'slash-hash.txt');

const definitions = [
  new SlashCommandBuilder().setName('join').setDescription('Join your voice channel'),
  new SlashCommandBuilder().setName('leave').setDescription('Leave the voice channel'),
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
  new SlashCommandBuilder().setName('shuffle').setDescription('Shuffle the current queue'),
  new SlashCommandBuilder().setName('history').setDescription('Show recently played tracks'),
  new SlashCommandBuilder().setName('mirrors').setDescription('Show Monochrome mirror health stats'),
  new SlashCommandBuilder().setName('voteskip').setDescription('Post a vote to skip the current track'),
  new SlashCommandBuilder().setName('autosearch').setDescription('Search and immediately queue the top result')
    .addStringOption(o => o.setName('query').setDescription('Artist, title, or album').setRequired(true)),
];

export async function registerSlashCommands(token: string, clientId: string, guildId: string): Promise<void> {
  const body = definitions.map(d => d.toJSON());
  const hash = createHash('sha256').update(JSON.stringify(body)).digest('hex');

  try {
    const saved = readFileSync(HASH_PATH, 'utf8').trim();
    if (saved === hash) {
      console.log('Slash commands unchanged — skipping registration');
      return;
    }
  } catch { /* no saved hash yet */ }

  const rest = new REST().setToken(token);
  await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body });
  writeFileSync(HASH_PATH, hash);
  console.log(`Registered ${definitions.length} slash commands`);
}
