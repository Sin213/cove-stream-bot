const MAX_HISTORY = 20;

export interface HistoryEntry {
  title: string;
  artists: string[];
  playedAt: number;
}

const history: HistoryEntry[] = [];

export function pushHistory(title: string, artists: string[]): void {
  history.push({ title, artists, playedAt: Date.now() });
  if (history.length > MAX_HISTORY) history.shift();
}

export function getHistory(): HistoryEntry[] {
  return [...history].reverse();
}
