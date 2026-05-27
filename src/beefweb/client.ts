import type { PlayerState, TrackInfo, Playlist, PlaylistItem } from './types.js';

const COLUMNS = ['%artist%', '%title%', '%album%', '%path%'];

export class BeefwebClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL.replace(/\/$/, '');
  }

  private async request(path: string, method = 'GET', body?: unknown): Promise<unknown> {
    const opts: RequestInit = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${this.baseURL}${path}`, opts);
    if (!res.ok) throw new Error(`Beefweb ${method} ${path}: ${res.status}`);
    const text = await res.text();
    return text ? JSON.parse(text) : undefined;
  }

  async getPlayerState(): Promise<PlayerState> {
    const cols = COLUMNS.map(encodeURIComponent).join(',');
    const data = await this.request(`/api/player?columns=${cols}`) as { player: PlayerState };
    return data.player;
  }

  async play(): Promise<void> {
    await this.request('/api/player/play', 'POST');
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
    const cols = COLUMNS.map(encodeURIComponent).join(',');
    const data = await this.request(
      `/api/playlists/${playlistId}/items/${offset}:${offset + count}?columns=${cols}`
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
  }

  async removeItem(playlistId: string, index: number): Promise<void> {
    await this.request(`/api/playlists/${playlistId}/items/remove`, 'POST', { ranges: [[index, 1]] });
  }

  async getCurrentPlaylistId(): Promise<string> {
    const playlists = await this.getPlaylists();
    const current = playlists.find(p => p.isCurrent);
    if (current) return current.id;
    if (playlists.length > 0) return playlists[0].id;
    throw new Error('No playlists exist in the player');
  }
}
