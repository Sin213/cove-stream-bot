import type { PlayerBackend, PlayerState, TrackInfo, Playlist, PlaylistItem } from '../player/types.js';

const COLUMNS = ['%artist%', '%title%', '%album%', '%path%'];
const COLUMNS_ENC = COLUMNS.map(encodeURIComponent).join(',');
const PLAYLIST_ID_TTL = 30_000;
const REQUEST_TIMEOUT_MS = 8_000;

export class BeefwebClient implements PlayerBackend {
  readonly name = 'Beefweb';

  private baseURL: string;
  private _inflightState: Promise<PlayerState> | null = null;
  private _playlistIdCache: string | null = null;
  private _playlistIdExpiry = 0;

  constructor(baseURL: string) {
    this.baseURL = baseURL.replace(/\/$/, '');
  }

  private async request(path: string, method = 'GET', body?: unknown): Promise<unknown> {
    const opts: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${this.baseURL}${path}`, opts);
    if (!res.ok) throw new Error(`Beefweb ${method} ${path}: ${res.status}`);
    const text = await res.text();
    return text ? JSON.parse(text) : undefined;
  }

  async getPlayerState(): Promise<PlayerState> {
    if (this._inflightState) return this._inflightState;
    this._inflightState = this.request(`/api/player?columns=${COLUMNS_ENC}`)
      .then(data => (data as { player: PlayerState }).player)
      .finally(() => { this._inflightState = null; });
    return this._inflightState;
  }

  invalidatePlaylistCache(): void {
    this._playlistIdCache = null;
    this._playlistIdExpiry = 0;
  }

  async play(): Promise<void> {
    await this.request('/api/player/play', 'POST');
  }

  async playItem(playlistId: string, index: number): Promise<void> {
    await this.request(`/api/player/play/${playlistId}/${index}`, 'POST');
  }

  async pause(): Promise<void> {
    await this.request('/api/player/pause', 'POST');
  }

  async pauseToggle(): Promise<void> {
    await this.request('/api/player/pause/toggle', 'POST');
  }

  async next(): Promise<void> {
    await this.request('/api/player/next', 'POST');
  }

  async previous(): Promise<void> {
    await this.request('/api/player/previous', 'POST');
  }

  async stop(): Promise<void> {
    await this.request('/api/player/stop', 'POST');
  }

  async seek(position: number): Promise<void> {
    await this.request('/api/player', 'POST', { position });
  }

  async getCurrentTrack(): Promise<TrackInfo | null> {
    const state = await this.getPlayerState();
    if (!state.activeItem || state.activeItem.index < 0) return null;
    const cols = state.activeItem.columns;
    return {
      artist: cols[0] ?? 'Unknown',
      title: cols[1] ?? 'Unknown',
      album: cols[2] ?? 'Unknown',
      duration: state.activeItem.duration,
      position: state.activeItem.position,
      trackIndex: state.activeItem.index,
      path: cols[3] ?? '',
    };
  }

  async getPlaylists(): Promise<Playlist[]> {
    const data = await this.request('/api/playlists') as { playlists: Playlist[] };
    return data.playlists;
  }

  async getPlaylistItems(playlistId: string, offset = 0, count = 100): Promise<PlaylistItem[]> {
    const data = await this.request(
      `/api/playlists/${playlistId}/items/${offset}:${offset + count}?columns=${COLUMNS_ENC}`
    ) as { playlistItems: { items: PlaylistItem[] } };
    return data.playlistItems.items;
  }

  async addItems(
    playlistId: string,
    items: string[],
    opts?: { play?: boolean; index?: number },
  ): Promise<void> {
    const body: Record<string, unknown> = { items };
    if (opts?.play) body.play = true;
    if (opts?.index !== undefined) body.index = opts.index;
    await this.request(`/api/playlists/${playlistId}/items/add`, 'POST', body);
    this.invalidatePlaylistCache();
  }

  async copyItems(playlistId: string, items: number[], targetIndex: number): Promise<void> {
    await this.request(`/api/playlists/${playlistId}/items/copy`, 'POST', { items, targetIndex });
    this.invalidatePlaylistCache();
  }

  async removeItem(playlistId: string, index: number): Promise<void> {
    await this.request(`/api/playlists/${playlistId}/items/remove`, 'POST', { items: [index] });
    this.invalidatePlaylistCache();
  }

  async clearItems(playlistId: string, fromIndex: number, count: number): Promise<void> {
    if (count <= 0) return;
    const items = Array.from({ length: count }, (_, i) => fromIndex + i);
    await this.request(`/api/playlists/${playlistId}/items/remove`, 'POST', { items });
    this.invalidatePlaylistCache();
  }

  async getCurrentPlaylistId(): Promise<string> {
    if (this._playlistIdCache && Date.now() < this._playlistIdExpiry) {
      return this._playlistIdCache;
    }
    const playlists = await this.getPlaylists();
    const current = playlists.find(p => p.isCurrent);
    const id = current?.id ?? playlists[0]?.id;
    if (!id) throw new Error('No playlists exist in the player');
    this._playlistIdCache = id;
    this._playlistIdExpiry = Date.now() + PLAYLIST_ID_TTL;
    return id;
  }

  async shuffle(playlistId: string): Promise<void> {
    await this.request(`/api/playlists/${playlistId}/items/sort`, 'POST', { by: 'random' });
  }

  async setVolume(percent: number): Promise<void> {
    const state = await this.getPlayerState();
    const { min, max } = state.volume;
    const value = min + (Math.max(0, Math.min(100, percent)) / 100) * (max - min);
    await this.request('/api/player', 'POST', { volume: value });
  }
}
