import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { BeefwebClient } from '../beefweb/client.js';
import type { RelayManager } from '../voice/relay.js';

export function startWebServer(beefweb: BeefwebClient, relay: RelayManager, port: number): void {
  const app = express();
  const __dirname = dirname(fileURLToPath(import.meta.url));

  app.use(express.static(join(__dirname, '..', '..', 'src', 'web')));

  app.get('/api/state', async (_req, res) => {
    try {
      const player = await beefweb.getPlayerState();
      const track = await beefweb.getCurrentTrack();
      res.json({
        relayRunning: relay.isRunning(),
        playbackState: player.playbackState,
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
