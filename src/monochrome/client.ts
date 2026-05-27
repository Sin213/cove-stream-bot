import type { TrackMatch, StreamInfo } from './types.js';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const STATS_PATH = resolve(process.cwd(), 'mirror-stats.json');

interface MirrorFailure {
  mirror: string;
  category: 'network' | 'http' | 'parse' | 'unknown';
  status?: number;
  detail: string;
  streamError?: string;
}

function classifyFetchError(err: unknown): Pick<MirrorFailure, 'category' | 'detail'> {
  if (!(err instanceof Error)) return { category: 'unknown', detail: String(err) };
  const msg = err.message;
  const cause = (err as any).cause;
  if (cause?.code === 'ENOTFOUND' || cause?.code === 'EAI_AGAIN')
    return { category: 'network', detail: `DNS: ${cause.code}` };
  if (cause?.code === 'ECONNREFUSED')
    return { category: 'network', detail: 'connection refused' };
  if (cause?.code === 'ECONNRESET' || cause?.code === 'EPIPE')
    return { category: 'network', detail: `connection reset (${cause.code})` };
  if (cause?.code === 'ETIMEDOUT' || cause?.code === 'UND_ERR_CONNECT_TIMEOUT')
    return { category: 'network', detail: 'timeout' };
  if (msg.includes('self-signed') || msg.includes('certificate') || msg.includes('SSL'))
    return { category: 'network', detail: 'TLS/certificate error' };
  if (msg === 'fetch failed' && cause)
    return { category: 'network', detail: cause.code ?? cause.message ?? 'fetch failed' };
  return { category: 'unknown', detail: msg.slice(0, 120) };
}

function redactUrl(url: string): string {
  try {
    const u = new URL(url);
    u.search = '';
    u.hash = '';
    return u.origin + u.pathname;
  } catch {
    return url.split('?')[0];
  }
}

function safeBodySnippet(text: string): string {
  const clean = text.replace(/["\s]*(?:token|cookie|auth|key|secret|signature|sig)["\s]*:\s*"[^"]*"/gi, '"[REDACTED]"');
  return clean.slice(0, 200);
}

interface FailureSummary {
  reason: string;
  primary?: string;
}

function summarizeFailures(failures: MirrorFailure[]): FailureSummary {
  if (failures.length === 0) return { reason: 'ALL_MIRRORS_FAILED' };

  const credentialFail = failures.find(f => f.streamError === 'CREDENTIAL_EXPIRED');
  if (credentialFail) return { reason: 'CREDENTIAL_EXPIRED' };

  const statusCounts = new Map<number, number>();
  let networkCount = 0;
  let parseCount = 0;

  for (const f of failures) {
    if (f.category === 'network') networkCount++;
    else if (f.category === 'parse') parseCount++;
    else if (f.category === 'http' && f.status) {
      statusCounts.set(f.status, (statusCounts.get(f.status) ?? 0) + 1);
    }
  }

  const uniform = failures.length > 0 &&
    (networkCount === failures.length || parseCount === failures.length ||
     (statusCounts.size === 1 && networkCount === 0 && parseCount === 0));

  if (networkCount === failures.length) return { reason: 'NETWORK_ERROR' };
  if (parseCount === failures.length) return { reason: 'INVALID_RESPONSE' };

  if (statusCounts.size > 0) {
    const sorted = [...statusCounts.entries()].sort((a, b) => b[1] - a[1]);
    const dominant = sorted[0][0];
    if (uniform) return { reason: `HTTP_${dominant}` };
    return { reason: 'ALL_MIRRORS_FAILED', primary: `HTTP_${dominant}` };
  }

  return { reason: 'ALL_MIRRORS_FAILED' };
}

export class MonochromeClient {
  private baseURLs: string[];
  private quality: string;
  private qobuzBaseURLs: string[];
  private mirrorStats = new Map<string, { ok: number; total: number }>();

  constructor(baseURLs: string[], quality: string, qobuzBaseURLs: string[] = []) {
    this.baseURLs = baseURLs.map(u => u.replace(/\/$/, ''));
    this.quality = quality;
    this.qobuzBaseURLs = qobuzBaseURLs.map(u => u.replace(/\/$/, ''));
    try {
      const saved = JSON.parse(readFileSync(STATS_PATH, 'utf8')) as Record<string, { ok: number; total: number }>;
      for (const [k, v] of Object.entries(saved)) this.mirrorStats.set(k, v);
    } catch { /* first run */ }
  }

  private mirrorSuccessRate(base: string): number {
    const s = this.mirrorStats.get(base);
    return s && s.total > 0 ? s.ok / s.total : 1;
  }

  private recordMirrorResult(base: string, success: boolean): void {
    const s = this.mirrorStats.get(base) ?? { ok: 0, total: 0 };
    if (success) s.ok++;
    s.total++;
    this.mirrorStats.set(base, s);
    try {
      writeFileSync(STATS_PATH, JSON.stringify(Object.fromEntries(this.mirrorStats)));
    } catch { /* non-fatal */ }
  }

  async search(query: string, limit: number): Promise<TrackMatch[]> {
    const path = `/search/?s=${encodeURIComponent(query)}&limit=${limit}&offset=0`;
    const data = await this.requestWithFailover(path) as {
      data?: { items?: unknown[] };
    };

    const items = data?.data?.items;
    if (!Array.isArray(items)) return [];

    return items.map((item: any) => {
      let albumArtUrl: string | undefined;
      const cover = item.album?.cover ?? item.cover;
      if (typeof cover === 'string' && cover.length > 0) {
        albumArtUrl = `https://resources.tidal.com/images/${cover.replace(/-/g, '/')}/320x320.jpg`;
      }
      return {
        tidalId: item.id,
        title: item.title ?? 'Unknown',
        artists: Array.isArray(item.artists) && item.artists.length > 0
          ? item.artists.map((a: any) => a.name ?? 'Unknown')
          : item.artist?.name ? [item.artist.name] : [],
        album: item.album?.title ?? 'Unknown',
        durationSec: item.duration ?? 0,
        quality: item.audioQuality ?? 'UNKNOWN',
        isrc: typeof item.isrc === 'string' ? item.isrc : undefined,
        albumArtUrl,
      };
    });
  }

  async getStreamUrl(tidalId: number, quality?: string, isrc?: string): Promise<string> {
    const q = quality ?? this.quality;
    const path = `/track/?id=${tidalId}&quality=${q}`;
    let tidalError: Error | undefined;

    try {
      const data = await this.requestWithFailover(path) as Record<string, unknown>;
      const url = this.extractStreamUrl(data);
      if (url) return url;
      const reason = this.classifyMissingUrl(data);
      this.logStreamShapeDiag(tidalId, data, path, reason);
      tidalError = new Error(`No playable URL in track response for ${tidalId}`);
      (tidalError as any).reason = reason;
    } catch (err) {
      tidalError = err as Error;
    }

    if (isrc && this.qobuzBaseURLs.length > 0) {
      const qobuzUrl = await this.tryQobuzFallback(isrc, q);
      if (qobuzUrl) return qobuzUrl;
    }

    throw tidalError;
  }

  private qualityToQobuzFormat(quality: string): string {
    switch (quality.toUpperCase()) {
      case 'HI_RES_LOSSLESS': return '27';
      case 'LOSSLESS': return '6';
      default: return '5';
    }
  }

  private async tryQobuzFallback(isrc: string, quality: string): Promise<string | null> {
    const qobuzQuality = this.qualityToQobuzFormat(quality);
    for (const base of this.qobuzBaseURLs) {
      try {
        const searchRes = await fetch(
          `${base}/api/get-music?q=${encodeURIComponent(isrc)}&offset=0`,
          { signal: AbortSignal.timeout(8000) },
        );
        if (!searchRes.ok) continue;
        const searchJson = await searchRes.json() as Record<string, any>;
        const tracks: any[] = searchJson?.data?.tracks?.items ?? [];
        const match = tracks.find(t => t.isrc?.toLowerCase() === isrc.toLowerCase()) ?? tracks[0];
        if (!match?.id) continue;

        const streamRes = await fetch(
          `${base}/api/download-music?track_id=${match.id}&quality=${qobuzQuality}`,
          { signal: AbortSignal.timeout(8000) },
        );
        if (!streamRes.ok) continue;
        const streamJson = await streamRes.json() as Record<string, any>;
        const url = streamJson?.data?.url;
        if (typeof url === 'string' && url.startsWith('http')) {
          console.log(`[qobuz] stream resolved via ${redactUrl(base)}`);
          return url;
        }
      } catch (err) {
        console.warn(`[qobuz] ${redactUrl(base)} failed for ISRC ${isrc}:`, err instanceof Error ? err.message : err);
      }
    }
    return null;
  }

  private logStreamShapeDiag(
    tidalId: number,
    data: Record<string, unknown>,
    path?: string,
    failureCategory?: string,
  ): void {
    const topKeys = Object.keys(data ?? {});
    const nested = data?.data as Record<string, unknown> | undefined;
    const nestedKeys = nested ? Object.keys(nested) : [];
    const hasManifest = nested && typeof nested.manifest === 'string';
    const detail = nested?.detail ?? data?.detail;
    console.error(`[monochrome] Track ${tidalId} — no playable URL found`);
    if (path) console.error(`  endpoint: ${path}`);
    if (failureCategory) console.error(`  failure category: ${failureCategory}`);
    console.error(`  top-level keys: [${topKeys.join(', ')}]`);
    if (nestedKeys.length) console.error(`  data keys: [${nestedKeys.join(', ')}]`);
    if (nested?.assetPresentation) console.error(`  assetPresentation: ${nested.assetPresentation}`);
    if (nested?.audioQuality) console.error(`  audioQuality: ${nested.audioQuality}`);
    if (nested?.manifestMimeType) console.error(`  manifestMimeType: ${nested.manifestMimeType}`);
    if (hasManifest) console.error('  manifest present (DASH/encrypted?) — no direct stream URL extracted');
    if (detail) console.error(`  API detail: ${String(detail).slice(0, 150)}`);
  }

  private classifyMissingUrl(data: Record<string, unknown>): string {
    const nested = data?.data as Record<string, unknown> | undefined;
    if (nested?.assetPresentation === 'PREVIEW') return 'PREVIEW_ONLY';
    const detail = (nested?.detail ?? data?.detail) as string | undefined;
    if (typeof detail === 'string') {
      const lower = detail.toLowerCase();
      if (lower.includes('subscription') || lower.includes('payment') ||
          lower.includes('full-access') || lower.includes('full access')) {
        return 'REQUIRES_SUBSCRIPTION';
      }
    }
    if (nested && typeof nested.manifest === 'string') return 'MANIFEST_ONLY';
    if (typeof detail === 'string' && detail.length > 0) return 'UPSTREAM_ERROR';
    if (!data || Object.keys(data).length === 0) return 'EMPTY_RESPONSE';
    return 'MISSING_STREAM_URL';
  }

  private extractStreamUrl(data: Record<string, unknown>): string | null {
    const candidates = [
      data?.url,
      data?.stream_url,
      data?.streamUrl,
    ];
    const nested = data?.data as Record<string, unknown> | undefined;
    if (nested) {
      if (typeof nested.manifest === 'string') {
        const raw = nested.manifest;
        let parsed: any = null;
        try {
          parsed = JSON.parse(raw);
        } catch {
          try {
            parsed = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
          } catch {
            if (raw.startsWith('http')) candidates.push(raw);
          }
        }
        if (parsed) {
          const urlEntry = parsed?.urls?.[0];
          const urlFromEntry = typeof urlEntry === 'string' ? urlEntry
            : (urlEntry && typeof urlEntry.url === 'string' ? urlEntry.url : undefined);
          const segment = parsed?.encryptedMediaUrl ?? urlFromEntry ?? parsed?.url;
          if (typeof segment === 'string') candidates.push(segment);
        }
      }
      candidates.push(nested.url, nested.stream_url, nested.streamUrl);
    }
    for (const c of candidates) {
      if (typeof c === 'string' && c.startsWith('http')) return c;
    }
    return null;
  }

  private async requestWithFailover(path: string): Promise<unknown> {
    const sorted = [...this.baseURLs].sort(
      (a, b) => this.mirrorSuccessRate(b) - this.mirrorSuccessRate(a),
    );

    const tryMirror = async (base: string): Promise<unknown> => {
      const mirror = redactUrl(base);
      let res: Response;
      try {
        res = await fetch(`${base}${path}`, {
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(15000),
        });
      } catch (err) {
        this.recordMirrorResult(base, false);
        const classified = classifyFetchError(err);
        throw { mirror, ...classified } as MirrorFailure;
      }

      if (!res.ok) {
        let bodyText = '';
        try { bodyText = await res.text(); } catch { /* ignore */ }
        const bodySnippet = safeBodySnippet(bodyText);
        this.recordMirrorResult(base, false);
        if (res.status === 401 && bodyText.includes('Token refresh failed')) {
          console.error(`[monochrome] CREDENTIAL_EXPIRED on ${mirror}${path} — 401 Token refresh failed`);
          throw { mirror, category: 'http', status: res.status, detail: bodySnippet || 'Token refresh failed', streamError: 'CREDENTIAL_EXPIRED' } as MirrorFailure;
        }
        throw { mirror, category: 'http', status: res.status, detail: bodySnippet || `HTTP ${res.status}` } as MirrorFailure;
      }

      const text = await res.text();
      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch {
        this.recordMirrorResult(base, false);
        throw { mirror, category: 'parse', detail: `invalid JSON: ${safeBodySnippet(text)}` } as MirrorFailure;
      }
      this.recordMirrorResult(base, true);
      return data;
    };

    try {
      return await Promise.any(sorted.map(base => tryMirror(base)));
    } catch (aggErr) {
      const failures: MirrorFailure[] = (aggErr instanceof AggregateError)
        ? aggErr.errors as MirrorFailure[]
        : [{ mirror: 'unknown', category: 'unknown', detail: String(aggErr) }];

      console.error(`[monochrome] All ${failures.length} mirrors failed for ${path}`);
      for (const f of failures) {
        const status = f.status ? ` (${f.status})` : '';
        console.error(`  ${f.mirror}: [${f.category}]${status} ${f.detail}`);
      }

      const summary = summarizeFailures(failures);
      const err = new Error(`All ${failures.length} Monochrome mirrors failed (${summary.reason})`);
      (err as any).mirrorFailures = failures;
      (err as any).reason = summary.reason;
      (err as any).primaryFailure = summary.primary;
      throw err;
    }
  }

  getMirrorStats(): { url: string; ok: number; total: number; rate: number }[] {
    return [...this.baseURLs].map(base => {
      const s = this.mirrorStats.get(base) ?? { ok: 0, total: 0 };
      return { url: redactUrl(base), ok: s.ok, total: s.total, rate: s.total > 0 ? s.ok / s.total : 1 };
    });
  }
}
