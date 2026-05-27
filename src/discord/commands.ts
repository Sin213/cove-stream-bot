import type { BeefwebClient } from '../beefweb/client.js';
import type { MonochromeClient } from '../monochrome/client.js';
import type { RelayManager } from '../voice/relay.js';
import type { VoiceConnectionManager } from '../voice/connection.js';

export interface CommandContext {
  beefweb: BeefwebClient;
  monochrome: MonochromeClient;
  relayManager: RelayManager;
  voiceManager: VoiceConnectionManager;
}

export interface Responder {
  userId: string;
  channel: { send(content: string): Promise<unknown> } | null;
  member: { voice: { channel: { id: string; name: string; guild: unknown } | null } } | null;
  reply(content: string): Promise<void>;
}

export type CommandHandler = (responder: Responder, args: string[], ctx: CommandContext) => Promise<void>;

export async function reply(responder: Responder, content: string): Promise<void> {
  await responder.reply(content);
}

const commands = new Map<string, CommandHandler>();

export function registerCommand(name: string, handler: CommandHandler): void {
  commands.set(name.toLowerCase(), handler);
}

export function getCommand(name: string): CommandHandler | undefined {
  return commands.get(name.toLowerCase());
}
