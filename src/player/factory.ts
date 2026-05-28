import { CONFIG } from '../config.js';
import { BeefwebClient } from '../beefweb/client.js';
import type { PlayerBackend } from './types.js';

export function createPlayerBackend(): PlayerBackend {
  switch (CONFIG.PLAYER_BACKEND) {
    case 'beefweb':
      return new BeefwebClient(CONFIG.BEEFWEB_BASE_URL);
    default:
      throw new Error(`Unsupported PLAYER_BACKEND: ${CONFIG.PLAYER_BACKEND}`);
  }
}
