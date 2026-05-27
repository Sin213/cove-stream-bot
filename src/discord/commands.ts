import type { Message } from 'discord.js';
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

export type CommandHandler = (message: Message, args: string[], ctx: CommandContext) => Promise<void>;

export async function reply(message: Message, content: string): Promise<void> {
  if ('send' in message.channel && typeof message.channel.send === 'function') {
    await message.channel.send(content);
  }
}

const commands = new Map<string, CommandHandler>();

export function registerCommand(name: string, handler: CommandHandler): void {
  commands.set(name.toLowerCase(), handler);
}

export function getCommand(name: string): CommandHandler | undefined {
  return commands.get(name.toLowerCase());
}
