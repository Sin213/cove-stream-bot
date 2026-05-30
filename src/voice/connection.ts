import {
  joinVoiceChannel,
  createAudioPlayer,
  VoiceConnection,
  AudioPlayer,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
} from '@discordjs/voice';
import type { VoiceBasedChannel } from 'discord.js';

export class VoiceConnectionManager {
  public connection: VoiceConnection | null = null;
  public player: AudioPlayer | null = null;

  async join(channel: VoiceBasedChannel, onFatalDisconnect?: () => void): Promise<AudioPlayer> {
    this.connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: true,
    });

    this.connection.on('stateChange', (oldState, newState) => {
      console.log(`Voice: ${oldState.status} -> ${newState.status}`);
    });

    // @discordjs/voice auto-rejoins transient drops (all close codes except 4014).
    // The unrecoverable case (endpoint removed / adapter gone / 4014) otherwise
    // parks in Disconnected forever — bot looks alive but is permanently silent.
    // Race Signalling vs Connecting to tell "reconnecting" from "dead", then tear down.
    this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
      const conn = this.connection;
      if (!conn) return;
      try {
        await Promise.race([
          entersState(conn, VoiceConnectionStatus.Signalling, 5_000),
          entersState(conn, VoiceConnectionStatus.Connecting, 5_000),
        ]);
        // Reconnecting — let the library finish recovering.
      } catch {
        console.warn('Voice: unrecoverable disconnect — tearing down connection.');
        try { conn.destroy(); } catch { /* already destroyed */ }
        if (this.connection === conn) {
          this.connection = null;
          this.player?.stop(true);
          this.player = null;
        }
        try { onFatalDisconnect?.(); } catch { /* ignore */ }
      }
    });

    await entersState(this.connection, VoiceConnectionStatus.Ready, 30_000);

    this.player = createAudioPlayer();
    this.connection.subscribe(this.player);

    this.player.on('error', (error) => {
      console.error('Audio player error:', error.message);
    });

    this.player.on('stateChange', (oldState, newState) => {
      console.log(`Player: ${oldState.status} -> ${newState.status}`);
    });

    return this.player;
  }

  leave(): void {
    this.player?.stop(true);
    this.player?.removeAllListeners();
    try { this.connection?.destroy(); } catch { /* already destroyed */ }
    this.connection = null;
    this.player = null;
  }

  isConnected(): boolean {
    return this.connection !== null;
  }
}
