import { VoiceConnectionManager } from '../voice/connection.js';
import { RelayManager } from '../voice/relay.js';
import { CONFIG } from '../config.js';
import { loadGuildState } from '../security/persist.js';

export class GuildState {
  readonly guildId: string;
  readonly voiceManager: VoiceConnectionManager;
  readonly relayManager: RelayManager;
  announceChannelId: string | null = null;
  approvedUserIds: Set<string>;
  blacklistedUserIds: Set<string>;
  voteSkipMessageId: string | null = null;

  constructor(guildId: string) {
    this.guildId = guildId;
    this.voiceManager = new VoiceConnectionManager();
    this.relayManager = new RelayManager();
    const persisted = loadGuildState(guildId);
    this.approvedUserIds = new Set(persisted?.approvedUserIds ?? CONFIG.APPROVED_USER_IDS);
    this.blacklistedUserIds = new Set(persisted?.blacklistedUserIds ?? CONFIG.BLACKLISTED_USER_IDS);
  }
}

const registry = new Map<string, GuildState>();

export function getGuildState(guildId: string): GuildState {
  let state = registry.get(guildId);
  if (!state) {
    state = new GuildState(guildId);
    registry.set(guildId, state);
  }
  return state;
}

export function getAllGuildStates(): GuildState[] {
  return [...registry.values()];
}
