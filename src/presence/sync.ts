import { Client, ActivityType } from 'discord.js';
import type { PlayerBackend } from '../player/types.js';
import { getTrackMeta } from '../monochrome/trackMeta.js';
import type { TrackMeta } from '../monochrome/trackMeta.js';
import { CONFIG } from '../config.js';
import { pushHistory } from '../history/store.js';
import { advanceQueue } from '../queue/store.js';
import { looksLikeUrl } from '../util/text.js';

type TrackChangeCallback = (title: string, artist: string, meta?: TrackMeta) => void | Promise<void>;

let lastSignature = '';
let syncRunning = false;

export function startPresenceSync(
  client: Client,
  player: PlayerBackend,
  onTrackChange?: TrackChangeCallback,
): NodeJS.Timeout {
  return setInterval(async () => {
    if (syncRunning) return;
    syncRunning = true;
    try {
      const track = await player.getCurrentTrack();

      if (!track) {
        if (lastSignature !== '') {
          lastSignature = '';
          client.user?.setPresence({
            activities: [{ name: 'music', type: ActivityType.Listening }],
            status: 'online',
          });
        }
        return;
      }

      const stored = getTrackMeta(track.trackIndex, track.path);
      const rawArtist = track.artist !== 'Unknown' && !looksLikeUrl(track.artist) ? track.artist : '';
      const rawTitle = track.title !== 'Unknown' && !looksLikeUrl(track.title) ? track.title : '';
      const artist = stored?.artists[0] || rawArtist;
      const title = stored?.title || rawTitle;

      // Include track index so signature changes even for URL-only tracks with no metadata
      const signature = (artist || title) ? `${artist}|${title}` : `idx:${track.trackIndex}`;
      if (signature === lastSignature) return;

      lastSignature = signature;
      advanceQueue();

      if (artist || title) {
        pushHistory(title, artist ? [artist] : []);
        const name = artist ? `${artist} — ${title}` : title;
        client.user?.setPresence({
          activities: [{ name, type: ActivityType.Listening }],
          status: 'online',
        });
      }

      if (onTrackChange) await onTrackChange(title, artist, stored ?? undefined);
    } catch {
      // Beefweb unreachable — silently skip this tick
    } finally {
      syncRunning = false;
    }
  }, CONFIG.STATUS_POLL_MS);
}
