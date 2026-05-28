import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { PlayerBackend } from '../player/types.js';
import type { RelayManager } from '../voice/relay.js';

export function startWebServer(player: PlayerBackend, relay: RelayManager, port: number): void {
  const app = express();
  const __dirname = dirname(fileURLToPath(import.meta.url));

  app.use(express.static(join(__dirname, '..', '..', 'src', 'web')));

  app.get('/api/state', async (_req, res) => {
    try {
      const state = await player.getPlayerState();
      const track = await player.getCurrentTrack();
      res.json({
        relayRunning: relay.isRunning(),
        backend: player.name,
        playbackState: state.playbackState,
        track,
      });
    } catch {
      res.status(503).json({ error: 'Backend unavailable' });
    }
  });

  app.listen(port, () => {
    console.log(`Web UI at http://localhost:${port}`);
  });
}
