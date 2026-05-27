type SendableChannel = { send(content: string): Promise<unknown> };

let announceChannel: SendableChannel | null = null;

export function setAnnounceChannel(ch: SendableChannel | null): void {
  announceChannel = ch;
}

export function getAnnounceChannel(): SendableChannel | null {
  return announceChannel;
}
