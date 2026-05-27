export interface PlayerState {
  playbackState: 'playing' | 'paused' | 'stopped';
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
