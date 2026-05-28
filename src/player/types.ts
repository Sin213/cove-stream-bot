export type PlaybackState = 'playing' | 'paused' | 'stopped';

export interface PlayerState {
  playbackState: PlaybackState;
  activeItem: {
    index: number;
    playlistId: string;
    playlistIndex: number;
    columns: string[];
    duration: number;
    position: number;
  };
  volume: {
    type: string;
    min: number;
    max: number;
    value: number;
    isMuted: boolean;
  };
}

export interface TrackInfo {
  title: string;
  artist: string;
  album: string;
  duration: number;
  position: number;
  trackIndex: number;
  path: string;
}

export interface Playlist {
  id: string;
  index: number;
  title: string;
  isCurrent: boolean;
  itemCount: number;
  totalTime: number;
}

export interface PlaylistItem {
  columns: string[];
}

export interface PlayerBackend {
  readonly name: string;
  getPlayerState(): Promise<PlayerState>;
  getCurrentTrack(): Promise<TrackInfo | null>;
  play(): Promise<void>;
  playItem(playlistId: string, index: number): Promise<void>;
  pause(): Promise<void>;
  pauseToggle(): Promise<void>;
  next(): Promise<void>;
  previous(): Promise<void>;
  stop(): Promise<void>;
  seek(position: number): Promise<void>;
  getPlaylists(): Promise<Playlist[]>;
  getPlaylistItems(playlistId: string, offset?: number, count?: number): Promise<PlaylistItem[]>;
  addItems(playlistId: string, items: string[], opts?: { play?: boolean; index?: number }): Promise<void>;
  copyItems(playlistId: string, items: number[], targetIndex: number): Promise<void>;
  removeItem(playlistId: string, index: number): Promise<void>;
  clearItems(playlistId: string, fromIndex: number, count: number): Promise<void>;
  getCurrentPlaylistId(): Promise<string>;
  shuffle(playlistId: string): Promise<void>;
  setVolume(percent: number): Promise<void>;
}
