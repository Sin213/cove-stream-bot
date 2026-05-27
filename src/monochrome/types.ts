export interface TrackMatch {
  tidalId: number;
  title: string;
  artists: string[];
  album: string;
  durationSec: number;
  quality: string;
  isrc?: string;
  albumArtUrl?: string;
}

export interface StreamInfo {
  url: string;
  quality: string;
  mimeType: string;
  codec: string;
}
