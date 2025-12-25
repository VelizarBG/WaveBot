import { Event } from 'djs-handlers';
import { AuditLogEvent, channelMention, GuildAuditLogsEntry, inlineCode, roleMention } from "discord.js";
import { handleEventError } from "../util/loggers";
import { EmbedAction, ModerationEmbedOptions } from "../classes/ModerationEmbedBuilder";
import { getAsJsonIfObject, getUsers, sendEmbedToModLogs } from "../util/helpers";

export default new Event('guildAuditLogEntryCreate', async (logEntry, guild) => {
  try {
    const { action, executorId, targetId } = logEntry;

    if (executorId == null) {
      return;
    }

    let embedOptions: ModerationEmbedOptions | null = null;

    switch (logEntry.action) {
      case AuditLogEvent.MemberUpdate: {
        const { executor, target } = await getUsers(executorId, targetId, guild);

        if (!executor || !target) {
          break;
        }

        const expiry = logEntry.changes.find(c => c.key === 'communication_disabled_until');
        if (!expiry) {
          break;
        }

        const embedAction: EmbedAction = expiry.new ? 'timeout' : 'remove timeout';
        embedOptions = {
          target: target.user,
          executor: executor,
          action: embedAction,
          reason: logEntry.reason,
          extra: expiry.new ? `**Expires**: <t:${Math.trunc(Date.parse(expiry.new) / 1000)}:F>` : undefined
        };
        break;
      }
      case AuditLogEvent.RoleCreate:
      case AuditLogEvent.RoleDelete: {
        const executor = await guild.members.fetch(executorId);
        let embedAction: EmbedAction;
        let name: string;
        if (action === AuditLogEvent.RoleCreate) {
          embedAction = 'create role';
          name = '';
        } else {
          embedAction = 'delete role';
          name = `(${logEntry.changes.find(c => c.key === 'name')?.old as string}) `;
        }
        embedOptions = {
          executor: executor,
          action: embedAction,
          reason: logEntry.reason,
          extra: `**Role**: ${roleMention(targetId as string)} ${name}(${inlineCode(targetId as string)})`
        };
        break;
      }
      case AuditLogEvent.RoleUpdate: {
        const executor = await guild.members.fetch(executorId);
        const changes = [];
        for (const change of logEntry.changes) {
          changes.push(`\n**Property**: '${change.key}' old: '${getAsJsonIfObject(change.old)}' new: '${getAsJsonIfObject(change.new)}'`);
        }
        const changeStr = ''.concat(...changes);
        embedOptions = {
          executor: executor,
          action: 'update role',
          reason: logEntry.reason,
          extra: `**Role**: ${roleMention(targetId as string)} (${inlineCode(targetId as string)})${changeStr}`
        };
        break;
      }
      case AuditLogEvent.MemberRoleUpdate: {
        const { executor, target } = await getUsers(executorId, targetId, guild);

        if (!executor || !target) {
          break;
        }

        const added = logEntry.changes.find(c => c.key === "$add")
          ?.new?.map(r => roleMention(r.id));

        const removed = logEntry.changes.find(c => c.key === "$remove")
          ?.new?.map(r => roleMention(r.id));

        let givenTakenStr: string = '';
        if (added) {
          givenTakenStr = `**Given**: ${added.join(' ')}`;
        }

        if (removed) {
          givenTakenStr = givenTakenStr.concat(`${added ? '\n' : ''}**Taken**: ${removed.join(' ')}`);
        }

        embedOptions = {
          target: target.user,
          executor: executor,
          action: 'give/take roles',
          reason: logEntry.reason,
          extra: givenTakenStr
        };
        break;
      }
      case AuditLogEvent.MessageDelete: {
        const isCorrectType = (_logEntry: GuildAuditLogsEntry): _logEntry is GuildAuditLogsEntry<AuditLogEvent.MessageDelete> => true;
        if (!isCorrectType(logEntry)) {
          break;
        }

        const { executor, target } = await getUsers(executorId, targetId, guild);

        if (!executor || !target) {
          break;
        }

        embedOptions = {
          target: target.user,
          executor: executor,
          action: 'delete message',
          reason: logEntry.reason,
          extra: `**Channel**: ${channelMention(logEntry.extra.channel.id)}`
        };
        break;
      }
    }

    if (embedOptions != null) {
      await sendEmbedToModLogs(embedOptions, guild);
    }
  } catch (err) {
    return handleEventError({
      err,
      client: logEntry.executor!.client,
      guild: guild,
      message: `Failed to log audit log entry.`,
    });
  }
});