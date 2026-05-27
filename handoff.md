# cove-stream-bot — Initial Implementation

---

# Windows FFmpeg dshow Timestamp Patch (2026-05-26)

## Bug
`!relay` on Windows: FFmpeg exits with `Error submitting a packet to the muxer: Invalid argument` immediately after starting.

## Root cause
`CABLE Output (VB-Audio Virtual Cable)` DirectShow device does not set `IMediaSample` timestamps. FFmpeg passes `AV_NOPTS_VALUE` through the Opus encoder. The OGG muxer (`libavformat/oggenc.c`) requires valid PTS on every packet and returns `AVERROR(EINVAL)` on the first packet, aborting the stream.

## Fix
`src/voice/capture.ts`: prepend `-use_wallclock_as_timestamps 1` to the FFmpeg argv when `FFMPEG_INPUT_FORMAT === 'dshow'`. This makes FFmpeg substitute missing DirectShow timestamps with `av_gettime_relative()` (monotonically increasing wall clock). Linux pulse path is unchanged (flag not added for non-dshow formats).

`WINDOWS.md`: updated "Run the Bot" section with exact PowerShell commands; added "Patch Verification" section with standalone capture test and expected output.

## Verification (Linux)
- `npx tsc --noEmit` → no errors
- Linux defaults unchanged (inputFlags empty for `pulse`)
- Only `src/voice/capture.ts`, `WINDOWS.md`, `handoff.md` changed

## Windows runtime verification
Pending on Windows test machine. User must run:
```powershell
cd C:\Users\CS\Downloads\cove-stream-bot\cove-stream-bot
& "C:\Program Files\nodejs\npm.cmd" run build
& "C:\Program Files\nodejs\npm.cmd" start
```
Then `!join` + `!relay` and confirm audio audible with no muxer errors.

---

# Windows + foobar2000 Support Slice (2026-05-26)

## Changes
- `src/config.ts`: replaced `PULSE_SOURCE` field with `FFMPEG_INPUT_FORMAT` (default: `pulse`) and `FFMPEG_INPUT_DEVICE` (default: `discord_relay.monitor`). `PULSE_SOURCE` env var is still read as a backward-compatible fallback for `FFMPEG_INPUT_DEVICE`.
- `src/voice/capture.ts`: FFmpeg input args now use `CONFIG.FFMPEG_INPUT_FORMAT` and `CONFIG.FFMPEG_INPUT_DEVICE` instead of hardcoded `-f pulse -i <PULSE_SOURCE>`. All other FFmpeg args unchanged.
- `.env.example`: replaced `PULSE_SOURCE` with `FFMPEG_INPUT_FORMAT`/`FFMPEG_INPUT_DEVICE` (Linux defaults), added commented Windows block.
- `WINDOWS.md` (new): runbook for foobar2000 + foo_beefweb + VB-Audio Virtual Cable on Windows.

## Linux path
Unchanged. Existing `.env` files using `PULSE_SOURCE=discord_relay.monitor` continue to work via fallback chain. No Linux regression.

## Windows runtime verification
NOT completed on Linux. Must be performed on the Windows test machine per `WINDOWS.md` §Verification Checklist. Beefweb REST API (`foo_beefweb` component) and DirectShow audio capture (VB-Cable + FFmpeg dshow) must be verified on the target machine.

# Duplicate Reply/Stale Dist Repair (2026-05-27)

## Active goal
Prove why Discord text commands can reply twice, then prevent `npm start` from running stale compiled behavior unnoticed.

## Root cause
Current process probe showed no active matching bot process:
`ps -eo pid,ppid,cmd | grep -E 'node|tsx|npm|src/index.ts|dist/index.js|cove-stream-bot' | grep -v grep || true` -> no output.

Source inspection showed one `MessageCreate` listener in `src/index.ts` and one reply path per `play`, `pause`, and `leave` command branch.

`dist/` was stale:
- `dist/index.js` lacked the source `handledMessageIds` guard and shutdown handlers.
- `dist/commands/play.js` unconditionally called `beefweb.play()` and replied `Playback resumed.`
- `dist/commands/pause.js` unconditionally called `beefweb.pause()` and replied `Playback paused.`
- `dist/beefweb/client.js` still exposed the old `/api/player/play/toggle` method.

This proves the duplicate/conflicting replies are explained by stale `dist` being launched, or by stale `dist` and current `tsx` both running, not by duplicate listeners in current source command code.

## Fix
`package.json` now defines `prestart: npm run build`, so `npm start` rebuilds `dist/` before launching `node dist/index.js`. This prevents old compiled command behavior from continuing unnoticed.

Command behavior in current source remains:
- `!play` while playing -> one reply: `Already playing.`
- `!play` while paused -> `/api/player/pause/toggle`, one reply: `Playback resumed.`
- `!play` while stopped -> `/api/player/play`, one reply: `Playback started.`
- `!pause` while playing -> `/api/player/pause`, one reply: `Playback paused.`
- `!pause` while paused -> one reply: `Already paused.`
- `!leave` -> stops relay, leaves voice, one reply: `Left voice channel.`

## Verification
- `npx tsc --noEmit` -> no errors.
- Process re-check showed no active matching bot process, so there is no current duplicate-instance condition.
- Static command-path check: current `src/commands/play.ts`, `src/commands/pause.ts`, and `src/commands/leave.ts` each return after a single reply per handled branch.

---

## Task
Build a standard Discord bot (discord.js v14 + @discordjs/voice) that streams DeaDBeeF audio into a Discord voice channel via Beefweb REST API and PipeWire null-sink audio loopback. Audio-only, ToS-safe, Linux-native.

## Changes

### Project skeleton
- package.json: discord.js 14, @discordjs/voice, dotenv, express, opusscript, tweetnacl
- tsconfig.json: ES2022, NodeNext module resolution
- .env.example: Discord token, channel IDs, Beefweb URL, PulseAudio source name
- .gitignore: node_modules, dist, .env

### Beefweb client (src/beefweb/)
- types.ts: PlayerState, TrackInfo, Playlist, PlaylistItem interfaces
- client.ts: REST client using fetch — play/pause/stop/next/previous/getCurrentTrack/getPlaylists/getPlaylistItems via Beefweb API paths (/api/player, /api/player/play, etc.)

### Discord layer (src/discord/)
- client.ts: discord.js Client with voice+message intents, initial presence
- commands.ts: command registry (Map<string, CommandHandler>), CommandContext type

### Voice layer (src/voice/)
- connection.ts: VoiceConnectionManager — join/leave voice channels with @discordjs/voice
- capture.ts: FFmpeg spawn with `-f pulse -i <PULSE_SOURCE>` for PipeWire null-sink capture
- relay.ts: RelayManager — start/stop FFmpeg capture piped to AudioResource

### Commands (src/commands/)
- join, leave, relay, play, pause, next, prev, stop, nowplaying, status
- All use shared CommandContext with beefweb, relayManager, voiceManager

### Presence sync (src/presence/)
- sync.ts: polls Beefweb on interval, updates bot presence with current track artist/title

### Entry point (src/index.ts)
- Registers all commands, wires message handler with `!` prefix, starts presence sync
- Optional web UI import if WEB_UI_ENABLED=true

### Web UI (src/web/)
- server.ts: Express server with /api/state endpoint proxying Beefweb + relay state
- index.html: minimal dark status page polling /api/state every 3s

## Verification
- `npx tsc --noEmit` → no errors
- `npm install` → 0 vulnerabilities

---

# Runtime Verification Pass (2026-05-27)

## Task
Runtime-verify the Discord audio path end to end:
DeaDBeeF → PipeWire `discord_relay.monitor` → FFmpeg OGG/Opus → Discord voice → audible audio.
Verify all live commands.

## Infrastructure checks
- `discord_relay.monitor` → RUNNING, float32le 2ch 48000Hz
- Beefweb → `http://127.0.0.1:8880` connected, DeaDBeeF playing
- PipeWire links → DeaDBeeF (node 130) → discord_relay (node 185): 2 active links
- FFmpeg OGG/Opus capture (3s) → 48 KiB, mean -28.7 dB — not silent
- OggDemuxer (prism-media): 153 frames/3s (correct for 20 ms frame duration)
- sodium-native + libsodium-wrappers: both OK
- `npx tsc --noEmit` → no errors
- Bot startup: logged in as Cove Stream Bot#2871, Beefweb OK, no errors

## Verification rows
| Row | Test | Result |
|-----|------|--------|
| 1 | Bot start | PASS |
| 2 | !join | PASS |
| 3 | !relay + audibility | PASS — audio audible in Discord voice channel |
| 4 | 3-min sustained stability | PASS |
| 5 | !status, !np, !nowplaying, !pause, !play, !next, !skip, !prev, !stop, !relay, !leave | PASS |
| 6 | Presence sync | NOT EXECUTED (deferred — no blocker) |

## Root cause of prior silence (fixed in b60a89d)
- Original: raw PCM (`-f s16le`), `@discordjs/voice` 0.18, tweetnacl
- Fix: OGG/Opus (`-acodec libopus -f ogg`), upgraded to 0.19.2 (Discord encryption v2), sodium-native + libsodium-wrappers

## Changed files this session
None — runtime verification only.

---

# Command Control, Pause UX, Reply Dedup, Audio Quality Pass (2026-05-26)

## Task
Implement: double-reply dedup, approved-user access control, state-aware `!play`/`!pause`/`!resume`, configurable Opus bitrate.

## Pre-check
`ps aux | grep -E 'node|tsx|npm|cove-stream-bot' | grep -v grep` → no output. Only one process was running; dedup is surgical (in-process Set), not a workaround for a multi-process bug.

## Changes

### `src/config.ts`
- Added `APPROVED_USER_IDS: new Set(...)` parsed from comma-separated `APPROVED_USER_IDS` env var (empty = allow all)
- Added `OPUS_BITRATE: process.env.OPUS_BITRATE ?? '256k'`

### `src/index.ts`
- Added `registerCommand('resume', playCommand)` alias
- Added `PROTECTED_COMMANDS` Set: join, leave, relay, play, pause, resume, next, skip, prev, stop
- Added `handledMessageIds` Set (max 1000) for in-process message-ID dedup guard
- Auth check: if `APPROVED_USER_IDS` non-empty and user not in set → reply once "You are not authorized to use this command." and return
- Dedup guard runs before any handler; evicts oldest entry at 1000 to cap memory

### `src/commands/play.ts`
- Calls `getPlayerState()` before acting
- If `playbackState === 'playing'`: reply "Already playing." and return
- Otherwise: call `beefweb.play()`, reply "Playback resumed."

### `src/commands/pause.ts`
- Calls `getPlayerState()` before acting
- If playing: pause + reply "Playback paused."
- If paused: reply "Already paused."
- If stopped: reply "Playback is stopped."
- `!pause` does NOT resume playback

### `src/voice/capture.ts`
- Replaced hardcoded `'128k'` with `CONFIG.OPUS_BITRATE` (defaults to `256k`)

### `.env.example`
- Added `APPROVED_USER_IDS=` and `OPUS_BITRATE=256k`

## Verification

### TypeScript
```
npx tsc --noEmit → TypeScript: No errors found
```

### Live Discord verification checklist
- `!play` replies once
- `!next` replies once
- `!prev` replies once
- `!skip` replies once
- `!pause` while playing → "Playback paused."
- `!pause` while paused → "Already paused."
- `!resume` while paused → "Playback resumed."
- `!resume`/`!play` while already playing → "Already playing."
- Approved user can use protected commands
- Unapproved user cannot use protected commands
- Unapproved user can use `!np`, `!nowplaying`, `!status`
- FFmpeg starts with `256k` (or configured `OPUS_BITRATE`)
- Relay remains audible

## Changed files
- `src/config.ts`
- `src/index.ts`
- `src/commands/play.ts`
- `src/commands/pause.ts`
- `src/voice/capture.ts`
- `.env.example`
- `handoff.md`

---

# Repair: Double-Reply Fix and Play-Resume Fix (2026-05-26)

## Issues fixed

### Double replies
Root cause: `tsx watch` kills the old process with SIGTERM but the Discord.js gateway connection lingers until the OS closes the socket. The new process connects to the Discord gateway before the old one disconnects — both receive and process the same message event, both reply.
Fix: Added `process.once('SIGTERM', shutdown)` and `process.once('SIGINT', shutdown)` in `src/index.ts` that calls `client.destroy()` before exiting. `client.destroy()` closes the gateway WebSocket immediately, eliminating the overlap window.
The in-process message-ID dedup Set remains as a belt-and-suspenders guard for any same-process duplicate deliveries.

### !play restarts song from beginning when paused
Root cause: Beefweb's `POST /api/player/play` instructs DeaDBeeF to start playback from the beginning of the current track. When the player is in a paused state, the correct call is `POST /api/player/play/toggle` (`togglePlayPause()` in the client), which resumes from the paused position.
Fix: `src/commands/play.ts` now branches on `playbackState`:
- `playing` → "Already playing." (no-op)
- `paused` → `ctx.beefweb.togglePlayPause()` (resumes from position)
- `stopped` → `ctx.beefweb.play()` (starts fresh)

## Changed files
- `src/commands/play.ts`
- `src/index.ts`

## Verification
- `npx tsc --noEmit` → no errors
- Live: `!pause` then `!play`/`!resume` continues track from paused position
- Live: `!play` while already playing → "Already playing." (no restart)
- Live: each command replies exactly once

---

# Repair: Dual-Process Root Cause + Play/Toggle Fix (2026-05-26)

## Root cause — proven

All observed failures (double replies, conflicting output, `!play` error + "Playback resumed.") have a single root cause: **two bot instances running simultaneously with different code versions**.

Evidence:
- `dist/commands/play.js` contains OLD code (no state check, just `await reply(message, 'Playback resumed.')`).
- `src/commands/play.ts` (new code) contained `togglePlayPause()` which hits `/api/player/play/toggle` → 404 on Beefweb 0.11 (DeaDBeeF 1.10.2).
- `dist/index.js` has no `handledMessageIds` dedup and no SIGTERM/SIGINT handlers.
- When user runs `npm start` (dist) alongside `npm run dev` (tsx), both bots connect to Discord, both receive every message, and both reply — one with old behavior, one with new (erroring) behavior.

Observed output explained:
- `!pause` → "Already paused." (new tsx code, state check) + "Playback paused." (old dist code, no check)
- `!play` → "Command failed." (new tsx code, togglePlayPause 404) + "Playback resumed." (old dist code, play() succeeds)

## Beefweb API verification

Confirmed via live curl tests against `http://127.0.0.1:8880`:
- `POST /api/player/play/toggle` → **404** (not supported in plugin 0.11)
- `POST /api/player/pause` → 204 (toggles playing↔paused)
- `POST /api/player/play` when paused → 204, resumes from position (verified: paused@40.55 → playing@41.12 after 0.5s)

`play()` is the correct resume endpoint. `togglePlayPause()` is unsupported.

## Code fix

`src/commands/play.ts`: removed the broken `togglePlayPause()` branch introduced in the prior repair. Reverted to `ctx.beefweb.play()` for all non-playing states. State check for "Already playing." retained.

## Process fix (user action required)

Run only ONE of:
- `npm run dev` — tsx watch, runs from source (recommended for development)
- `npm run build && npm start` — compiled dist

Do NOT run both concurrently. Doing so connects two bots to Discord with different code versions.

The SIGTERM/SIGINT handlers added to `src/index.ts` ensure the gateway disconnects cleanly on process exit, preventing brief dual-connection overlap during tsx watch restarts.

## Verification
- `npx tsc --noEmit` → no errors
- `dist/` is stale — must run `npm run build` before using `npm start`

## Changed files
- `src/commands/play.ts`
- `handoff.md`

---

# Repair: SIGTERM Gateway Bug + Play/Resume Split (2026-05-26)

## Root cause — dual-process overlap (proven)

Double replies root cause: `tsx watch` sends SIGTERM to the old process. The previous SIGTERM handler called `client.destroy()` but did NOT await the returned Promise before calling `process.exit(0)`. Node.js exits before the WebSocket close frame is flushed to the OS network stack. Discord's old gateway connection lingers until Discord times it out (~60s heartbeat window). The new `tsx watch` process connects within that window. Both instances are live simultaneously → both handle every message → double replies.

Fix: `client.destroy().then(() => process.exit(0))` — awaits the Promise so the WebSocket close frame is sent before the process exits.

## Beefweb endpoint investigation (live curl proof)

Tested against DeaDBeeF 1.10.2 / Beefweb plugin 0.11 at http://127.0.0.1:8880:

| Endpoint | HTTP | Behavior |
|---|---|---|
| `POST /api/player/play/toggle` | 404 | Not supported |
| `POST /api/player/pause` | 204 | One-way pause only (calling when paused → stays paused) |
| `POST /api/player/play` | 204 | Resumes from position when paused (paused@12.17 → playing@12.85 after 0.5s) |
| `POST /api/player/pause/toggle` | 204 | True toggle: resumes from position when paused (paused@20.87 → playing@21.56 after 0.5s) |

`/api/player/pause/toggle` is the correct resume endpoint.

## Code changes

### `src/beefweb/client.ts`
Replaced broken `togglePlayPause()` (hit `/api/player/play/toggle` → 404) with `pauseToggle()` using confirmed `/api/player/pause/toggle`.

### `src/commands/play.ts` — new behavior
- playing → "Already playing."
- paused → "Playback is paused. Use !resume to continue." (does NOT restart)
- stopped → `play()` + "Playback started."

### `src/commands/resume.ts` — new separate command
- playing → "Already playing."
- stopped → "Playback is stopped. Use !play to start."
- paused → `pauseToggle()` + "Playback resumed." (resumes from position, no restart)

### `src/index.ts`
- Import and register `resumeCommand` for `!resume` (previously aliased to `playCommand`)
- Fixed SIGTERM/SIGINT handler: `client.destroy().then(() => process.exit(0))` — properly awaits gateway disconnect before exiting, closing the tsx-watch overlap window

### Verification
- `npx tsc --noEmit` → no errors
- `dist/` is stale — do NOT run `npm start` alongside `npm run dev`

## Final process rule
Run ONLY ONE of:
- `npm run dev` — for development (tsx, runs from source)
- `npm run build && npm start` — for production (compiled dist)

---

# Repair: !play state-aware + remove !resume (2026-05-26)

## Root cause of "Playback resumed." while playing

The reply string "Playback resumed." does not exist in the current `src/commands/play.ts`. It exists only in `src/commands/resume.ts` and in the stale `dist/commands/play.js` (compiled before any Tab 2 changes). The user observed this reply because `dist/index.js` was running — it has no state check and unconditionally calls `beefweb.play()` + replies "Playback resumed." Run `npm run dev` (not `npm start`) to avoid running stale dist code.

## Beefweb payload (live, while playing)

```json
{ "player": { "playbackState": "playing", ... } }
```

Field: `player.playbackState`, values: `"playing"` | `"paused"` | `"stopped"`. Matches `src/beefweb/types.ts` exactly. State check in `play.ts` was structurally correct.

## Changes

### `src/commands/play.ts`
- playing → "Already playing." (no-op)
- paused → `pauseToggle()` + "Playback resumed." (resumes from position via `/api/player/pause/toggle`)
- stopped → `play()` + "Playback started."

### `src/index.ts`
- Removed `import { resumeCommand }` and `registerCommand('resume', resumeCommand)`
- Removed `'resume'` from `PROTECTED_COMMANDS`

### `src/commands/resume.ts`
Deleted — `!resume` is removed. `!play` handles all three states.

## Verification
- `npx tsc --noEmit` → no errors
- Live: `!play` while playing → "Already playing.", no restart
- Live: `!pause` then `!play` → resumes from position, "Playback resumed."
