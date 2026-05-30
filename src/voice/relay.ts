import { createAudioResource, StreamType, AudioPlayer } from '@discordjs/voice';
import { createFFmpegCapture } from './capture.js';
import type { ChildProcess } from 'node:child_process';

const MAX_RESTARTS = 5;
const RESTART_WINDOW_MS = 60_000;
const RESTART_DELAY_MS = 1_000;

export class RelayManager {
  private ffmpeg: ChildProcess | null = null;
  private player: AudioPlayer | null = null;
  private stopped = true;
  private restartTimes: number[] = [];

  start(player: AudioPlayer): void {
    this.player = player;
    this.stopped = false;
    this.restartTimes = [];
    this.spawn();
  }

  private spawn(): void {
    const player = this.player;
    if (!player) return;

    // Detach the previous process so its exit doesn't trigger a spurious restart.
    if (this.ffmpeg) {
      this.ffmpeg.removeAllListeners('exit');
      if (!this.ffmpeg.killed) this.ffmpeg.kill('SIGTERM');
    }

    const proc = createFFmpegCapture();
    this.ffmpeg = proc;

    if (!proc.stdout) {
      throw new Error('FFmpeg stdout is null');
    }

    proc.stdout.once('data', (chunk: Buffer) => {
      console.log(`[relay] stdout first chunk: ${chunk.length}B magic=${JSON.stringify(chunk.subarray(0, 4).toString())}`);
    });
    proc.stdout.on('error', (e: Error) => console.error('[relay] stdout error:', e.message));
    proc.stdout.on('close', () => console.log('[relay] stdout closed'));

    const resource = createAudioResource(proc.stdout, {
      inputType: StreamType.OggOpus,
    });

    resource.playStream.on('error', (e: Error) => console.error('[relay] playStream error:', e.message));
    resource.playStream.on('end',   () => console.log('[relay] playStream ended'));
    resource.playStream.on('close', () => console.log('[relay] playStream closed'));

    // Auto-recover from an unexpected ffmpeg exit (device hiccup, pulse restart,
    // codec error) so a single blip doesn't leave the bot permanently silent.
    proc.on('exit', () => {
      if (this.stopped || this.ffmpeg !== proc) return; // intentional stop or superseded
      const now = Date.now();
      this.restartTimes = this.restartTimes.filter(t => now - t < RESTART_WINDOW_MS);
      if (this.restartTimes.length >= MAX_RESTARTS) {
        console.error(`[relay] ffmpeg exited ${MAX_RESTARTS}x within ${RESTART_WINDOW_MS / 1000}s — giving up auto-restart. Run !relay to retry.`);
        return;
      }
      this.restartTimes.push(now);
      console.warn('[relay] ffmpeg exited unexpectedly — restarting capture…');
      setTimeout(() => { if (!this.stopped && this.ffmpeg === proc) this.spawn(); }, RESTART_DELAY_MS);
    });

    player.play(resource);
    console.log('Relay started');
  }

  stop(): void {
    this.stopped = true;
    if (this.ffmpeg) {
      this.ffmpeg.removeAllListeners('exit');
      if (!this.ffmpeg.killed) this.ffmpeg.kill('SIGTERM');
    }
    this.ffmpeg = null;
    console.log('Relay stopped');
  }

  isRunning(): boolean {
    return !this.stopped && this.ffmpeg !== null && !this.ffmpeg.killed;
  }
}
