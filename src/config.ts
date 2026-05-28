import dotenv from 'dotenv';
dotenv.config();

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
}

export const CONFIG = {
  DISCORD_TOKEN: requireEnv('DISCORD_TOKEN'),
  GUILD_ID: requireEnv('GUILD_ID'),
  VOICE_CHANNEL_ID: requireEnv('VOICE_CHANNEL_ID'),
  TEXT_CHANNEL_ID: requireEnv('TEXT_CHANNEL_ID'),
  PLAYER_BACKEND: process.env.PLAYER_BACKEND ?? 'beefweb',
  BEEFWEB_BASE_URL: process.env.BEEFWEB_BASE_URL ?? 'http://127.0.0.1:8880',
  FFMPEG_PATH: process.env.FFMPEG_PATH ?? 'ffmpeg',
  FFMPEG_INPUT_FORMAT: process.env.FFMPEG_INPUT_FORMAT ?? 'pulse',
  FFMPEG_INPUT_DEVICE:
    process.env.FFMPEG_INPUT_DEVICE ??
    process.env.PULSE_SOURCE ??
    'discord_relay.monitor',
  STATUS_POLL_MS: parseInt(process.env.STATUS_POLL_MS ?? '10000', 10),
  WEB_UI_ENABLED: process.env.WEB_UI_ENABLED === 'true',
  WEB_UI_PORT: parseInt(process.env.WEB_UI_PORT ?? '3000', 10),
  APPROVED_USER_IDS: new Set(
    (process.env.APPROVED_USER_IDS ?? '')
      .split(',')
      .map(id => id.trim())
      .filter(id => id.length > 0)
  ),
  BLACKLISTED_USER_IDS: new Set(
    (process.env.BLACKLISTED_USER_IDS ?? '')
      .split(',')
      .map(id => id.trim())
      .filter(id => id.length > 0)
  ),
  OPUS_BITRATE: process.env.OPUS_BITRATE ?? '256k',
  MONOCHROME_API_BASE_URLS: (
    process.env.MONOCHROME_API_BASE_URLS ??
    'https://monochrome-api.samidy.com,https://tidal.squid.wtf'
  ).split(',').map(u => u.trim()).filter(u => u.length > 0),
  MONOCHROME_QUALITY: process.env.MONOCHROME_QUALITY ?? 'HIGH',
  MONOCHROME_SEARCH_LIMIT: parseInt(process.env.MONOCHROME_SEARCH_LIMIT ?? '8', 10),
  QOBUZ_BASE_URLS: (
    process.env.QOBUZ_BASE_URLS ?? 'https://qobuz.kennyy.com.br,https://qobuz.squid.wtf'
  ).split(',').map(u => u.trim()).filter(u => u.length > 0),
} as const;
