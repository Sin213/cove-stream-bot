interface UserWindow {
  count: number;
  windowStart: number;
}

const GLOBAL_LIMIT = 10;
const WINDOW_MS = 60_000;

// Per-command cooldowns in ms
const COOLDOWNS: Record<string, number> = {
  search: 3000,
  play: 2000,
  shuffle: 5000,
  volume: 2000,
  vol: 2000,
};

const COOLDOWN_TTL = Math.max(...Object.values(COOLDOWNS), WINDOW_MS);
const globalWindows = new Map<string, UserWindow>();
const lastUsed = new Map<string, number>();
let lastCleanup = 0;

function cleanup(now: number): void {
  if (now - lastCleanup < WINDOW_MS) return;
  lastCleanup = now;

  for (const [key, win] of globalWindows) {
    if (now - win.windowStart > WINDOW_MS) globalWindows.delete(key);
  }

  for (const [key, ts] of lastUsed) {
    if (now - ts > COOLDOWN_TTL) lastUsed.delete(key);
  }
}

export function checkRateLimit(
  guildId: string,
  userId: string,
  command: string,
): { allowed: boolean; reason?: string } {
  const now = Date.now();
  cleanup(now);
  const globalKey = `${guildId}:${userId}`;

  const win = globalWindows.get(globalKey) ?? { count: 0, windowStart: now };
  if (now - win.windowStart > WINDOW_MS) {
    win.count = 0;
    win.windowStart = now;
  }
  if (win.count >= GLOBAL_LIMIT) {
    return { allowed: false, reason: "You're sending commands too fast. Slow down." };
  }

  const cooldown = COOLDOWNS[command] ?? 0;
  if (cooldown > 0) {
    const cmdKey = `${globalKey}:${command}`;
    const last = lastUsed.get(cmdKey) ?? 0;
    const remaining = cooldown - (now - last);
    if (remaining > 0) {
      return { allowed: false, reason: `Wait ${Math.ceil(remaining / 1000)}s before using that again.` };
    }
    lastUsed.set(cmdKey, now);
  }

  win.count++;
  globalWindows.set(globalKey, win);
  return { allowed: true };
}
