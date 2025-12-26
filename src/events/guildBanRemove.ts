import { AuditLogEvent } from 'discord.js';
import { Event } from 'djs-handlers';
import { ModerationEmbedOptions } from '../classes/ModerationEmbedBuilder';
import { handleEventError } from '../util/loggers';
import { sendEmbedToModLogs } from '../util/helpers';

export default new Event('guildBanRemove', async (guildUnban) => {
  try {
    const unban = guildUnban.partial ? await guildUnban.fetch() : guildUnban;

    console.log(`${unban.user.username} was unbanned from ${unban.guild}.`);

    const fetchedLogs = await unban.guild.fetchAuditLogs({
      limit: 1,
      type: AuditLogEvent.MemberBanRemove,
    });

    const unbanLog = fetchedLogs.entries.first();

    if (!unbanLog) throw new Error('Cannot find UnbanLog.');

    const { executor, target, action, reason } = unbanLog;

    if (!executor || !target || action !== AuditLogEvent.MemberBanRemove) {
      throw new Error('Cannot find executor or target from the Audit Log.');
    }

    const executingMember = await unban.guild.members.fetch(executor.id);

    if (target.id === unban.user.id) {
      const banEmbedOptions: ModerationEmbedOptions = {
        target: unban.user,
        executor: executingMember,
        action: 'unban',
        reason: reason,
      };

      await sendEmbedToModLogs(banEmbedOptions, unban.guild);
    } else {
      throw new Error(
        'The IDs of the target in the AuditLog and the target from the Event did not match.',
      );
    }
  } catch (err) {
    return handleEventError({
      err,
      client: guildUnban.client,
      guild: guildUnban.guild,
      message: `Failed to log the unban of ${guildUnban.user.username}.`,
    });
  }
});
