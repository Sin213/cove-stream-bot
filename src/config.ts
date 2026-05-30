import dotenv from 'dotenv';
import { homedir, platform } from 'node:os';
import { join } from 'node:path';
dotenv.config();

// Whether to download online streams to a local file before playing them.
// DeaDBeeF (Linux) can't reliably stream remote audio (esp. non-faststart Tidal
// mp4), so default ON there; foobar2000 (Windows) streams fine, so default OFF.
// Override with STREAM_DOWNLOAD=on|off.
function resolveStreamDownload(): boolean {
  const v = (process.env.STREAM_DOWNLOAD ?? 'auto').trim().toLowerCase();
  if (v === 'on' || v === 'true' || v === '1') return true;
  if (v === 'off' || v === 'false' || v === '0') return false;
  return platform() === 'linux'; // 'auto'
}

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
}

// parseInt that falls back to a sane default instead of yielding NaN (a NaN
// STATUS_POLL_MS would turn the presence-sync setInterval into a busy loop).
function intEnv(raw: string | undefined, fallback: number): number {
  const n = parseInt(raw ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
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
  STATUS_POLL_MS: intEnv(process.env.STATUS_POLL_MS, 10000),
  WEB_UI_ENABLED: process.env.WEB_UI_ENABLED === 'true',
  WEB_UI_PORT: intEnv(process.env.WEB_UI_PORT, 3000),
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
    'https://monochrome-api.samidy.com'
  ).split(',').map(u => u.trim()).filter(u => u.length > 0),
  MONOCHROME_QUALITY: process.env.MONOCHROME_QUALITY ?? 'HIGH',
  // DeaDBeeF can't reliably stream remote audio (esp. non-faststart Tidal mp4)
  // over HTTP, so online tracks are downloaded here first and played as local
  // files. This dir MUST be listed in DeaDBeeF's `beefweb.music_dirs`.
  STREAM_DOWNLOAD: resolveStreamDownload(),
  STREAM_CACHE_DIR: process.env.STREAM_CACHE_DIR ?? join(homedir(), '.cache', 'cove-stream-bot'),
  STREAM_CACHE_MAX_FILES: intEnv(process.env.STREAM_CACHE_MAX_FILES, 60),
  MONOCHROME_SEARCH_LIMIT: intEnv(process.env.MONOCHROME_SEARCH_LIMIT, 8),
  QOBUZ_BASE_URLS: (
    process.env.QOBUZ_BASE_URLS ?? 'https://qobuz.squid.wtf'
  ).split(',').map(u => u.trim()).filter(u => u.length > 0),
} as const;
