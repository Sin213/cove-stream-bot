import type { PlayerBackend } from '../player/types.js';
import type { MonochromeClient } from '../monochrome/client.js';
import type { RelayManager } from '../voice/relay.js';
import type { VoiceConnectionManager } from '../voice/connection.js';
import type { GuildState } from '../guild/state.js';

export interface CommandContext {
  player: PlayerBackend;
  monochrome: MonochromeClient;
  relayManager: RelayManager;
  voiceManager: VoiceConnectionManager;
  guildState: GuildState;
}

/** A sent message that can later be deleted (Discord Message or interaction reply). */
export interface Deletable { delete(): Promise<unknown> }

export interface Responder {
  userId: string;
  guildId: string | null;
  channel: { id: string; send(content: unknown): Promise<unknown> } | null;
  member: { voice: { channel: { id: string; name: string; guild: unknown } | null } } | null;
  // Returns the sent message so callers can act on it (e.g. auto-delete). May be
  // undefined if the channel can't be replied to.
  reply(content: string | Record<string, unknown>): Promise<Deletable | undefined>;
}

export type CommandHandler = (responder: Responder, args: string[], ctx: CommandContext) => Promise<void>;

export async function reply(responder: Responder, content: string | Record<string, unknown>): Promise<Deletable | undefined> {
  return responder.reply(content);
}

/** Replies, then deletes the reply after `ms`. Works for both prefix and slash. */
export async function replyAndDelete(responder: Responder, content: string | Record<string, unknown>, ms: number): Promise<void> {
  const msg = await responder.reply(content);
  if (msg) setTimeout(() => msg.delete().catch(() => {}), ms);
}

const commands = new Map<string, CommandHandler>();

export function registerCommand(name: string, handler: CommandHandler): void {
  commands.set(name.toLowerCase(), handler);
}

export function getCommand(name: string): CommandHandler | undefined {
  return commands.get(name.toLowerCase());
}
