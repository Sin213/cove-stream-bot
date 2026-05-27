# Windows Runbook — foobar2000 + VB-Audio Virtual Cable

This guide covers running cove-stream-bot on Windows with foobar2000 as the music player.

## Prerequisites

### 1. Node.js
Install Node.js 20+ from https://nodejs.org/. Verify: `node --version`.

### 2. FFmpeg
Download a Windows build from https://ffmpeg.org/download.html (e.g. the gyan.dev release).
Either add `ffmpeg.exe` to your PATH, or set `FFMPEG_PATH` in `.env` to the full path
(e.g. `FFMPEG_PATH=C:\tools\ffmpeg\bin\ffmpeg.exe`).
Verify: `ffmpeg -version`.

### 3. foobar2000
Install from https://www.foobar2000.org/. Any recent version works.

### 4. foo_beefweb component
Download `foo_beefweb` from https://github.com/hyperblast/beefweb/releases.
Install: foobar2000 → File → Preferences → Components → Install… → select the `.fb2k-component` file.
Restart foobar2000.

Verify the REST API is running with a track loaded and playing:
```
curl http://127.0.0.1:8880/api/player
```
Expected: JSON with `player.playbackState` set to `"playing"` or `"paused"`.

### 5. VB-Audio Virtual Cable
Download and install from https://vb-audio.com/Cable/. No configuration needed after install.

## Audio Routing Setup

1. In foobar2000: Preferences → Playback → Output → Device → select **CABLE Input (VB-Audio Virtual Cable)**.
2. Play a track. Confirm in the Windows Volume Mixer that foobar2000 audio appears on the Virtual Cable channel, not the speakers.

## Enumerate DirectShow Capture Devices

Run this command to find the exact device name used by FFmpeg on your system:

```
ffmpeg -list_devices true -f dshow -i dummy
```

Look for a line like:
```
"CABLE Output (VB-Audio Virtual Cable)" (audio)
```

Copy the exact string (including any spacing/punctuation) for use in `FFMPEG_INPUT_DEVICE` below.

## Environment Configuration

Copy `.env.example` to `.env` and fill in your values:

```env
DISCORD_TOKEN=your_bot_token_here
GUILD_ID=your_guild_id
VOICE_CHANNEL_ID=your_voice_channel_id
TEXT_CHANNEL_ID=your_text_channel_id
BEEFWEB_BASE_URL=http://127.0.0.1:8880
FFMPEG_INPUT_FORMAT=dshow
FFMPEG_INPUT_DEVICE=audio=CABLE Output (VB-Audio Virtual Cable)
```

The `audio=` prefix before the device name is required by FFmpeg's dshow input. No shell
quoting is needed — the value is passed literally via `spawn()`.

## Run the Bot

```powershell
cd C:\Users\CS\Downloads\cove-stream-bot\cove-stream-bot
& "C:\Program Files\nodejs\npm.cmd" run build
& "C:\Program Files\nodejs\npm.cmd" start
```

Logs should show the bot logged in and "Beefweb connection OK".

## Patch Verification (FFmpeg dshow timestamp fix)

After pulling the latest code and rebuilding, verify the fix by watching FFmpeg stderr:

1. Start the bot: `& "C:\Program Files\nodejs\npm.cmd" start`
2. In Discord: `!join`, then `!relay`
3. Expected: bot stays connected, audio is audible in the voice channel
4. Confirm **no** `Error submitting a packet to the muxer: Invalid argument` in the console

If FFmpeg still exits with that error, run this standalone capture test to confirm dshow is the issue and the flag is accepted:

```powershell
ffmpeg -use_wallclock_as_timestamps 1 -f dshow -i "audio=CABLE Output (VB-Audio Virtual Cable)" -ac 2 -ar 48000 -acodec libopus -b:a 256k -application audio -frame_duration 20 -vbr on -f ogg -t 5 test_capture.ogg
```

Expected: `test_capture.ogg` is created, non-zero size, no muxer errors.
If you see "Invalid argument" even here, paste the full FFmpeg output for diagnosis.

## Verification Checklist

Run each command in your Discord text channel and verify the result:

| Command | Expected result |
|---------|----------------|
| `!join` | Bot joins the voice channel |
| `!relay` | Bot starts streaming; audio audible in Discord |
| `!np` | Bot replies with current track info |
| `!status` | Bot replies with player state |
| `!pause` | Playback pauses |
| `!play` | Playback resumes from paused position |
| `!next` | Advances to next track |
| `!prev` | Goes to previous track |
| `!stop` | Stops playback |
| `!leave` | Bot leaves the voice channel |

## Notes

- **VB-Audio Virtual Cable is the supported audio routing path.** It captures only foobar2000
  output, so Discord notifications, browsers, and other apps do not bleed into the stream.
- **Stereo Mix** is a best-effort fallback only: it captures all system audio (notifications,
  browsers, etc.) and may not exist on modern Windows systems. Not recommended.
- Do not run multiple bot instances at the same time.
- Do not run `npm start` and `npm run dev` simultaneously — both would connect to Discord
  and cause double replies.

## Troubleshooting

- **`curl /api/player` returns connection refused**: foobar2000 is not running, or
  `foo_beefweb` is not installed/enabled. Check Preferences → Components.
- **No audio in Discord**: check that foobar2000 output device is set to "CABLE Input",
  and that the `FFMPEG_INPUT_DEVICE` value matches the exact dshow device name from
  `ffmpeg -list_devices`.
- **FFmpeg exits immediately / `Error submitting a packet to the muxer: Invalid argument`**:
  VB-Audio Virtual Cable's `CABLE Output` device doesn't set DirectShow sample timestamps.
  This is fixed by `-use_wallclock_as_timestamps 1` (automatically applied when
  `FFMPEG_INPUT_FORMAT=dshow`). If you see this error after pulling the latest build,
  confirm you rebuilt: `npm run build`. If the error persists, run the standalone capture
  test in the "Patch Verification" section above and paste the output.
- **FFmpeg exits immediately (different error)**: the dshow device name is wrong or
  VB-Audio Virtual Cable is not installed. Re-run `ffmpeg -list_devices true -f dshow -i dummy` to confirm.
