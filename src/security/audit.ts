import { statSync } from 'fs';
import { appendFile, rename } from 'fs/promises';
import { resolve } from 'path';

const LOG_PATH = resolve(process.cwd(), 'audit.log');
const ROTATE_BYTES = 10 * 1024 * 1024; // 10 MB

// Track size in memory so we don't statSync() on every command. Seed it once
// from the existing log at startup.
let bytesWritten = 0;
try { bytesWritten = statSync(LOG_PATH).size; } catch { /* no log yet */ }

// Serialize writes so concurrent commands can't interleave or race rotation.
let writeChain: Promise<void> = Promise.resolve();

export function auditLog(guildId: string, userId: string, command: string, args: string[]): void {
  const ts = new Date().toISOString();
  const argsStr = args.length > 0 ? ` ${args.join(' ')}` : '';
  const line = `[${ts}] guild=${guildId} user=${userId} cmd=${command}${argsStr}\n`;
  writeChain = writeChain.then(async () => {
    try {
      if (bytesWritten >= ROTATE_BYTES) {
        await rename(LOG_PATH, `${LOG_PATH}.1`);
        bytesWritten = 0;
      }
      await appendFile(LOG_PATH, line);
      bytesWritten += Buffer.byteLength(line);
    } catch { /* non-fatal */ }
  });
}

/** Awaits any pending audit writes; call before process exit so queued entries aren't lost. */
export function flushAuditLog(): Promise<void> {
  return writeChain;
}
