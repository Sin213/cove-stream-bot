import { Client, ActivityType } from 'discord.js';
import { BeefwebClient } from '../beefweb/client.js';
import { getTrackMeta } from '../monochrome/trackMeta.js';
import { CONFIG } from '../config.js';

type TrackChangeCallback = (title: string, artist: string) => void;

let lastSignature = '';

export function startPresenceSync(
  client: Client,
  beefweb: BeefwebClient,
  onTrackChange?: TrackChangeCallback,
): NodeJS.Timeout {
  return setInterval(async () => {
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

      const stored = getTrackMeta(track.trackIndex, track.path);
      const artist = (stored?.artists[0]) || (track.artist !== 'Unknown' ? track.artist : '');
      const title = stored?.title || (track.title !== 'Unknown' ? track.title : '');

      if (!artist && !title) return;

      const signature = `${artist}|${title}`;
      if (signature === lastSignature) return;

      lastSignature = signature;
      const name = artist ? `${artist} — ${title}` : title;
      client.user?.setPresence({
        activities: [{ name, type: ActivityType.Listening }],
        status: 'online',
      });

      onTrackChange?.(title, artist);
    } catch {
      // Beefweb unreachable — silently skip this tick
    }
  }, CONFIG.STATUS_POLL_MS);
}
