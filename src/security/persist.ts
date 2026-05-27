import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

interface GuildPersistedState {
  approvedUserIds: string[];
  blacklistedUserIds: string[];
}

type PersistedData = Record<string, GuildPersistedState>;

const PERSIST_PATH = resolve(process.cwd(), 'guild-state.json');
let data: PersistedData = {};

try {
  data = JSON.parse(readFileSync(PERSIST_PATH, 'utf8')) as PersistedData;
} catch { /* first run */ }

export function loadGuildState(guildId: string): GuildPersistedState | undefined {
  return data[guildId];
}

export function saveGuildState(
  guildId: string,
  approvedUserIds: Set<string>,
  blacklistedUserIds: Set<string>,
): void {
  data[guildId] = {
    approvedUserIds: [...approvedUserIds],
    blacklistedUserIds: [...blacklistedUserIds],
  };
  try {
    writeFileSync(PERSIST_PATH, JSON.stringify(data, null, 2));
  } catch { /* non-fatal */ }
}
