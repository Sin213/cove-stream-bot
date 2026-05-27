import type { CommandHandler } from '../discord/commands.js';
import { reply } from '../discord/commands.js';

function parseUserId(mention: string): string | null {
  const match = mention.match(/^<@!?(\d+)>$/) ?? mention.match(/^(\d+)$/);
  return match?.[1] ?? null;
}

export const blacklistCommand: CommandHandler = async (message, args, ctx) => {
  const sub = args[0]?.toLowerCase();

  if (sub === 'list') {
    if (ctx.guildState.blacklistedUserIds.size === 0) {
      await reply(message, 'Blacklist is empty.');
    } else {
      const ids = [...ctx.guildState.blacklistedUserIds].map(id => `<@${id}>`).join(', ');
      await reply(message, `Blacklisted users: ${ids}`);
    }
    return;
  }

  if (sub === 'add' || sub === 'remove') {
    const raw = args[1];
    if (!raw) {
      await reply(message, `Usage: \`!blacklist ${sub} <@user or user ID>\``);
      return;
    }
    const userId = parseUserId(raw);
    if (!userId) {
      await reply(message, 'Could not parse a user ID. Mention the user or paste their ID.');
      return;
    }

    if (sub === 'add') {
      ctx.guildState.blacklistedUserIds.add(userId);
      ctx.guildState.approvedUserIds.delete(userId); // remove from whitelist if present
      await reply(message, `<@${userId}> blacklisted.`);
    } else {
      ctx.guildState.blacklistedUserIds.delete(userId);
      await reply(message, `<@${userId}> removed from blacklist.`);
    }
    return;
  }

  await reply(message, 'Usage: `!blacklist add|remove|list [@user]`');
};
