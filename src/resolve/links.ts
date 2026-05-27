import type { TrackMatch } from '../monochrome/types.js';
import type { MonochromeClient } from '../monochrome/client.js';

const SPOTIFY_RE = /open\.spotify\.com\/track\/([A-Za-z0-9]+)/;
const APPLE_RE = /music\.apple\.com\/[a-z]{2}\/.*?\/(\d+)(?:\?i=(\d+))?/;

export function isStreamingLink(arg: string): boolean {
  return SPOTIFY_RE.test(arg) || APPLE_RE.test(arg);
}

async function fetchOdesli(url: string): Promise<{ tidalId?: number; title?: string; artistName?: string } | null> {
  try {
    const res = await fetch(
      `https://api.song.link/v1-alpha.1/links?url=${encodeURIComponent(url)}&songIfSingle=true`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return null;
    const data = await res.json() as any;
    const entities: Record<string, any> = data?.entitiesByUniqueId ?? {};
    const tidalKey = Object.keys(entities).find(k => k.startsWith('TIDAL_SONG::'));
    if (tidalKey) {
      const entity = entities[tidalKey];
      return {
        tidalId: parseInt(tidalKey.split('::')[1], 10),
        title: entity?.title,
        artistName: entity?.artistName,
      };
    }
    // No TIDAL link — return title/artist from any available entity
    const anyKey = Object.keys(entities)[0];
    if (anyKey) {
      const entity = entities[anyKey];
      return { title: entity?.title, artistName: entity?.artistName };
    }
    return null;
  } catch {
    return null;
  }
}

export async function resolveStreamingLink(url: string, monochrome: MonochromeClient): Promise<TrackMatch | null> {
  const meta = await fetchOdesli(url);
  if (!meta) return null;

  if (meta.tidalId && !isNaN(meta.tidalId)) {
    // We have a TIDAL ID — return a minimal TrackMatch; stream URL resolved in play.ts
    return {
      tidalId: meta.tidalId,
      title: meta.title ?? 'Unknown',
      artists: meta.artistName ? [meta.artistName] : [],
      album: 'Unknown',
      durationSec: 0,
      quality: 'UNKNOWN',
    };
  }

  // No TIDAL ID — search Monochrome by title + artist
  if (meta.title) {
    const q = meta.artistName ? `${meta.title} ${meta.artistName}` : meta.title;
    const results = await monochrome.search(q, 5);
    if (results.length > 0) return results[0];
  }

  return null;
}
