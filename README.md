# cove-stream-bot

A Discord bot that streams audio from a local music player (DeaDBeeF or foobar2000) into a voice channel via the [Beefweb](https://github.com/hyperblast/beefweb) REST API. Supports both prefix (`!`) and slash (`/`) commands.

## Features

- Stream audio from DeaDBeeF (Linux) or foobar2000 (Windows) to Discord
- Full playback control: play, pause, stop, next, prev, restart, shuffle
- Queue management with persistent state across restarts
- Music search and streaming via Monochrome/Hi-Fi API (Tidal)
- Now-playing embeds with album art
- Auto now-playing announcements
- Vote-skip system
- Per-user whitelist/blacklist access control
- Rate limiting and audit logging
- Discord Rich Presence sync
- Optional web UI

## Requirements

- **Node.js** 20+
- **FFmpeg** in PATH (or set `FFMPEG_PATH`)
- **DeaDBeeF** with [beefweb plugin](https://github.com/hyperblast/beefweb) (Linux) or **foobar2000** with [foo_beefweb](https://github.com/hyperblast/beefweb/releases) (Windows)
- A Discord bot token

## Setup

```bash
git clone https://github.com/your-username/cove-stream-bot.git
cd cove-stream-bot
npm install
cp .env.example .env
```

Edit `.env` with your Discord token, guild ID, and channel IDs. See [`.env.example`](.env.example) for all options.

### Linux (DeaDBeeF + PipeWire/PulseAudio)

Create a virtual audio sink so the bot captures only player output:

```bash
# PipeWire
pw-cli create-node adapter '{ factory.name=support.null-audio-sink node.name=discord_relay media.class=Audio/Sink }'

# PulseAudio
pactl load-module module-null-sink sink_name=discord_relay sink_properties=device.description=discord_relay
```

Set DeaDBeeF output to the `discord_relay` sink, then configure `.env`:

```env
FFMPEG_INPUT_FORMAT=pulse
FFMPEG_INPUT_DEVICE=discord_relay.monitor
```

### Windows (foobar2000 + VB-Audio Virtual Cable)

See [WINDOWS.md](WINDOWS.md) for the full setup guide.

## Usage

```bash
npm run build
npm start
```

For development with hot reload:

```bash
npm run dev
```

## Commands

All commands work as both prefix (`!command`) and slash (`/command`).

### Playback

| Command | Description |
|---------|-------------|
| `join` | Join voice channel and start streaming |
| `leave` | Leave voice channel |
| `play [url]` | Resume playback or play a URL |
| `pause` | Pause playback |
| `stop` | Stop playback |
| `next` | Next track |
| `prev` | Previous track |
| `restart` | Restart current track |
| `shuffle` | Shuffle the playlist |

### Queue

| Command | Description |
|---------|-------------|
| `queue` | Show the current queue |
| `remove <position>` | Remove a track from the queue |
| `clearqueue` | Clear the entire queue |

### Search

| Command | Description |
|---------|-------------|
| `search <query>` | Search for tracks (Monochrome API) |
| `autosearch <query>` | Search and queue the first result |

### Info

| Command | Description |
|---------|-------------|
| `nowplaying` / `np` | Show current track info |
| `status` | Show player state |
| `history` | Show recently played tracks |
| `mirrors` | Show Monochrome API mirror status |

### Admin

| Command | Description |
|---------|-------------|
| `autonp` | Toggle auto now-playing announcements |
| `voteskip` | Vote to skip the current track |
| `whitelist <user>` | Add a user to the whitelist |
| `blacklist <user>` | Block a user from commands |

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `DISCORD_TOKEN` | — | Bot token (required) |
| `GUILD_ID` | — | Discord server ID (required) |
| `VOICE_CHANNEL_ID` | — | Voice channel to join (required) |
| `TEXT_CHANNEL_ID` | — | Text channel for responses (required) |
| `PLAYER_BACKEND` | `beefweb` | Player backend |
| `BEEFWEB_BASE_URL` | `http://127.0.0.1:8880` | Beefweb API URL |
| `FFMPEG_PATH` | `ffmpeg` | Path to FFmpeg binary |
| `FFMPEG_INPUT_FORMAT` | `pulse` | FFmpeg input format (`pulse` or `dshow`) |
| `FFMPEG_INPUT_DEVICE` | `discord_relay.monitor` | Audio capture device |
| `STATUS_POLL_MS` | `10000` | Player status polling interval |
| `OPUS_BITRATE` | `256k` | Opus encoding bitrate |
| `WEB_UI_ENABLED` | `false` | Enable web UI |
| `WEB_UI_PORT` | `3000` | Web UI port |
| `APPROVED_USER_IDS` | — | Comma-separated user IDs for admin access |
| `MONOCHROME_API_BASE_URLS` | — | Comma-separated Monochrome API mirrors |
| `MONOCHROME_QUALITY` | `HIGH` | Streaming quality |
| `MONOCHROME_SEARCH_LIMIT` | `8` | Max search results |

## License

MIT
