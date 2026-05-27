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

  async join(channel: VoiceBasedChannel): Promise<AudioPlayer> {
    this.connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: true,
    });

    this.connection.on('stateChange', (oldState, newState) => {
      console.log(`Voice: ${oldState.status} -> ${newState.status}`);
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
    this.connection?.destroy();
    this.connection = null;
    this.player = null;
  }

  isConnected(): boolean {
    return this.connection !== null;
  }
}
