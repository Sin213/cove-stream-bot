import { appendFileSync } from 'fs';
import { resolve } from 'path';

const LOG_PATH = resolve(process.cwd(), 'audit.log');

export function auditLog(guildId: string, userId: string, command: string, args: string[]): void {
  const ts = new Date().toISOString();
  const argsStr = args.length > 0 ? ` ${args.join(' ')}` : '';
  try {
    appendFileSync(LOG_PATH, `[${ts}] guild=${guildId} user=${userId} cmd=${command}${argsStr}\n`);
  } catch { /* non-fatal */ }
}
