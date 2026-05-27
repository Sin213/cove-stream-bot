import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { CONFIG } from '../config.js';

export function createFFmpegCapture(): ChildProcess {
  // dshow (Windows): VB-Cable doesn't set DirectShow sample timestamps, causing
  // AV_NOPTS_VALUE through the encoder → OGG muxer EINVAL on first packet.
  const inputFlags = CONFIG.FFMPEG_INPUT_FORMAT === 'dshow'
    ? ['-use_wallclock_as_timestamps', '1']
    : [];

  const args = [
    ...inputFlags,
    '-f', CONFIG.FFMPEG_INPUT_FORMAT,
    '-i', CONFIG.FFMPEG_INPUT_DEVICE,
    '-ac', '2',
    '-ar', '48000',
    '-acodec', 'libopus',
    '-b:a', CONFIG.OPUS_BITRATE,
    '-application', 'audio',
    '-frame_duration', '20',
    '-vbr', 'on',
    '-f', 'ogg',
    'pipe:1',
  ];

  const proc = spawn(CONFIG.FFMPEG_PATH, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  proc.stderr?.on('data', (data: Buffer) => {
    const line = data.toString().trim();
    if (line.includes('error') || line.includes('Error')) {
      console.error('FFmpeg:', line);
    }
  });

  proc.on('exit', (code) => {
    console.log(`FFmpeg exited with code ${code}`);
  });

  return proc;
}
