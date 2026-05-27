import { Client, ActivityType } from 'discord.js';
import { BeefwebClient } from '../beefweb/client.js';
import { getTrackMeta } from '../monochrome/trackMeta.js';
import type { TrackMeta } from '../monochrome/trackMeta.js';
import { CONFIG } from '../config.js';
import { pushHistory } from '../history/store.js';
import { advanceQueue } from '../queue/store.js';

type TrackChangeCallback = (title: string, artist: string, meta?: TrackMeta) => void | Promise<void>;

let lastSignature = '';
let syncRunning = false;

export function startPresenceSync(
  client: Client,
  beefweb: BeefwebClient,
  onTrackChange?: TrackChangeCallback,
): NodeJS.Timeout {
  return setInterval(async () => {
    if (syncRunning) return;
    syncRunning = true;
    try {
      const track = await beefweb.getCurrentTrack();

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

      function isUrl(s: string): boolean {
        return s.startsWith('http') || s.includes('://') || (s.includes('?') && s.includes('='));
      }

      const stored = getTrackMeta(track.trackIndex, track.path);
      const rawArtist = track.artist !== 'Unknown' && !isUrl(track.artist) ? track.artist : '';
      const rawTitle = track.title !== 'Unknown' && !isUrl(track.title) ? track.title : '';
      const artist = stored?.artists[0] || rawArtist;
      const title = stored?.title || rawTitle;

      if (!artist && !title) return;

      const signature = `${artist}|${title}`;
      if (signature === lastSignature) return;

      lastSignature = signature;
      advanceQueue();
      pushHistory(title, artist ? [artist] : []);

      const name = artist ? `${artist} — ${title}` : title;
      client.user?.setPresence({
        activities: [{ name, type: ActivityType.Listening }],
        status: 'online',
      });

      if (onTrackChange) await onTrackChange(title, artist, stored ?? undefined);
    } catch {
      // Beefweb unreachable — silently skip this tick
    } finally {
      syncRunning = false;
    }
  }, CONFIG.STATUS_POLL_MS);
}
