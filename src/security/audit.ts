import { appendFileSync, statSync, renameSync } from 'fs';
import { resolve } from 'path';

const LOG_PATH = resolve(process.cwd(), 'audit.log');
const ROTATE_BYTES = 10 * 1024 * 1024; // 10 MB

function rotateIfNeeded(): void {
  try {
    if (statSync(LOG_PATH).size >= ROTATE_BYTES) {
      renameSync(LOG_PATH, `${LOG_PATH}.1`);
    }
  } catch { /* file doesn't exist yet — fine */ }
}

export function auditLog(guildId: string, userId: string, command: string, args: string[]): void {
  const ts = new Date().toISOString();
  const argsStr = args.length > 0 ? ` ${args.join(' ')}` : '';
  try {
    rotateIfNeeded();
    appendFileSync(LOG_PATH, `[${ts}] guild=${guildId} user=${userId} cmd=${command}${argsStr}\n`);
  } catch { /* non-fatal */ }
}
