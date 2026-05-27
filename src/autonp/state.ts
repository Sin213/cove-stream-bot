let announceChannelId: string | null = null;

export function setAnnounceChannelId(id: string | null): void {
  announceChannelId = id;
}

export function getAnnounceChannelId(): string | null {
  return announceChannelId;
}
