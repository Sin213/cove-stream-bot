import type { CommandHandler } from '../discord/commands.js';
import { reply } from '../discord/commands.js';
import { CONFIG } from '../config.js';

function parseUserId(mention: string): string | null {
  // Accepts raw ID or <@id> / <@!id> mention format
  const match = mention.match(/^<@!?(\d+)>$/) ?? mention.match(/^(\d+)$/);
  return match?.[1] ?? null;
}

export const whitelistCommand: CommandHandler = async (message, args, _ctx) => {
  const sub = args[0]?.toLowerCase();

  if (sub === 'list') {
    if (CONFIG.APPROVED_USER_IDS.size === 0) {
      await reply(message, 'Whitelist is empty — all users can use protected commands.');
    } else {
      const ids = [...CONFIG.APPROVED_USER_IDS].map(id => `<@${id}>`).join(', ');
      await reply(message, `Whitelisted users: ${ids}`);
    }
    return;
  }

  if (sub === 'add' || sub === 'remove') {
    const raw = args[1];
    if (!raw) {
      await reply(message, `Usage: \`!whitelist ${sub} <@user or user ID>\``);
      return;
    }
    const userId = parseUserId(raw);
    if (!userId) {
      await reply(message, 'Could not parse a user ID. Mention the user or paste their ID.');
      return;
    }

    if (sub === 'add') {
      CONFIG.APPROVED_USER_IDS.add(userId);
      await reply(message, `<@${userId}> added to whitelist.`);
    } else {
      CONFIG.APPROVED_USER_IDS.delete(userId);
      await reply(message, `<@${userId}> removed from whitelist.`);
    }
    return;
  }

  await reply(message, 'Usage: `!whitelist add|remove|list [@user]`');
};
