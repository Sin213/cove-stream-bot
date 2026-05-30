// Shared text helpers — previously duplicated across presence/sync, nowplaying,
// voteskip and queue command modules.

/** Heuristic: does this string look like a URL / query string rather than a human label? */
export function looksLikeUrl(s: string): boolean {
  return s.startsWith('http') || s.includes('://') || (s.includes('?') && s.includes('='));
}

/** Returns the value if it's a usable human label, otherwise null. */
export function displayValue(value: string): string | null {
  return value !== 'Unknown' && !looksLikeUrl(value) ? value : null;
}

/**
 * Formats a time in seconds as `m:ss`. 0 is a valid time (`0:00`, e.g. a track
 * at the start); only negative / non-finite values render as `?:??`.
 */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '?:??';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Parses a raw Discord user ID or `<@id>` / `<@!id>` mention into a bare ID. */
export function parseUserId(mention: string): string | null {
  const match = mention.match(/^<@!?(\d+)>$/) ?? mention.match(/^(\d+)$/);
  return match?.[1] ?? null;
}
