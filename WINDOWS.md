# Windows Setup — foobar2000 + VB-Audio Virtual Cable

Guide for running cove-stream-bot on Windows with foobar2000 as the player backend.

## Prerequisites

| # | Software | Install |
|---|----------|---------|
| 1 | **Node.js 20+** | https://nodejs.org/ |
| 2 | **FFmpeg** | https://ffmpeg.org/download.html — add to PATH or set `FFMPEG_PATH` in `.env` |
| 3 | **foobar2000** | https://www.foobar2000.org/ |
| 4 | **foo_beefweb** | https://github.com/hyperblast/beefweb/releases — install via Preferences → Components |
| 5 | **VB-Audio Virtual Cable** | https://vb-audio.com/Cable/ |

Verify Beefweb is running (with a track loaded):

```
curl http://127.0.0.1:8880/api/player
```

## Audio Routing

1. In foobar2000: Preferences → Playback → Output → Device → **CABLE Input (VB-Audio Virtual Cable)**
2. Confirm in Windows Volume Mixer that foobar2000 audio goes to the Virtual Cable, not speakers

Find your exact device name for `.env`:

```
ffmpeg -list_devices true -f dshow -i dummy
```

Look for: `"CABLE Output (VB-Audio Virtual Cable)" (audio)`

## Environment Configuration

Copy `.env.example` to `.env` and set the Windows-specific values:

```env
DISCORD_TOKEN=your_bot_token_here
GUILD_ID=your_guild_id
VOICE_CHANNEL_ID=your_voice_channel_id
TEXT_CHANNEL_ID=your_text_channel_id
BEEFWEB_BASE_URL=http://127.0.0.1:8880
FFMPEG_INPUT_FORMAT=dshow
FFMPEG_INPUT_DEVICE=audio=CABLE Output (VB-Audio Virtual Cable)
```

The `audio=` prefix is required by FFmpeg's dshow input. No shell quoting needed — the value is passed literally via `spawn()`.

## Run

```powershell
npm run build
npm start
```

Logs should show the bot logged in and "Beefweb connection OK".

## Verification

| Command | Expected |
|---------|----------|
| `!join` | Bot joins voice and starts streaming |
| `!np` | Replies with current track info |
| `!pause` / `!play` | Pauses / resumes |
| `!next` / `!prev` | Track navigation |
| `!stop` | Stops playback |
| `!leave` | Bot leaves voice channel |

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `curl /api/player` refused | foobar2000 not running or foo_beefweb not installed. Check Preferences → Components |
| No audio in Discord | Confirm foobar2000 output is "CABLE Input" and `FFMPEG_INPUT_DEVICE` matches the exact dshow device name |
| FFmpeg exits with `Error submitting a packet to the muxer: Invalid argument` | Fixed automatically via `-use_wallclock_as_timestamps 1` when format is `dshow`. Rebuild with `npm run build` if on old code |
| FFmpeg exits with different error | Wrong device name or VB-Audio not installed. Re-run `ffmpeg -list_devices true -f dshow -i dummy` |

## Notes

- VB-Audio Virtual Cable captures only foobar2000 output — no system audio bleed
- Stereo Mix captures all system audio and is not recommended
- Don't run multiple bot instances simultaneously
