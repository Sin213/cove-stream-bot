import { createAudioResource, StreamType, AudioPlayer } from '@discordjs/voice';
import { createFFmpegCapture } from './capture.js';
import type { ChildProcess } from 'node:child_process';

export class RelayManager {
  private ffmpeg: ChildProcess | null = null;

  start(player: AudioPlayer): void {
    if (this.ffmpeg) this.stop();

    this.ffmpeg = createFFmpegCapture();

    if (!this.ffmpeg.stdout) {
      throw new Error('FFmpeg stdout is null');
    }

    this.ffmpeg.stdout.once('data', (chunk: Buffer) => {
      console.log(`[relay] stdout first chunk: ${chunk.length}B magic=${JSON.stringify(chunk.subarray(0, 4).toString())}`);
    });
    this.ffmpeg.stdout.on('error', (e: Error) => console.error('[relay] stdout error:', e.message));
    this.ffmpeg.stdout.on('close', () => console.log('[relay] stdout closed'));

    const resource = createAudioResource(this.ffmpeg.stdout, {
      inputType: StreamType.OggOpus,
    });

    resource.playStream.on('error', (e: Error) => console.error('[relay] playStream error:', e.message));
    resource.playStream.on('end',   () => console.log('[relay] playStream ended'));
    resource.playStream.on('close', () => console.log('[relay] playStream closed'));

    player.play(resource);
    console.log('Relay started');
  }

  stop(): void {
    if (this.ffmpeg && !this.ffmpeg.killed) {
      this.ffmpeg.kill('SIGTERM');
    }
    this.ffmpeg = null;
    console.log('Relay stopped');
  }

  isRunning(): boolean {
    return this.ffmpeg !== null && !this.ffmpeg.killed;
  }
}
