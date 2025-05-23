import { AuditLogEvent, inlineCode, time, userMention } from 'discord.js';
import { Event } from 'djs-handlers';
import { JoinLeaveEmbedBuilder } from '../classes/JoinLeaveEmbedBuilder';
import { ModerationEmbedBuilder } from '../classes/ModerationEmbedBuilder';
import { getJoinedAtComponent } from '../util/helpers';
import { getTextChannelFromID, handleEventError } from '../util/loggers';
import { getForkedServices } from "../index";
import { handleUserRoleChange } from "../role-whitelist/handlers/role-change-handler";

export default new Event('guildMemberRemove', async (member) => {
  try {
    console.log(`${member.user.username} left ${member.guild.name}`);

    const db = await getForkedServices();

    const oldRoles = member.roles.valueOf().keys();
    const newRoles: string[] = [];
    await handleUserRoleChange(member.id, oldRoles, newRoles, db);

    await db.em.flush();

    const joinedAt = getJoinedAtComponent(member);
    const memberLog = await getTextChannelFromID(member.guild, 'memberLog');

    const userLeaveEmbed = new JoinLeaveEmbedBuilder(member, 'left', {
      description: `Username: ${userMention(
        member.user.id,
      )}\nUser ID: ${inlineCode(member.user.id)}${joinedAt}\nLeft at: ${time(
        new Date(),
        'f',
      )} (${time(new Date(), 'R')})`,
    });

    memberLog.send({ embeds: [userLeaveEmbed] });

    // handle member being kicked from the guild
    const fetchedLogs = await member.guild.fetchAuditLogs({
      limit: 1,
      type: AuditLogEvent.MemberKick,
    });

    const kickLog = fetchedLogs.entries.first();

    if (!kickLog) return;

    const { executor, target, action, reason } = kickLog;

    if (!executor || !target || action !== AuditLogEvent.MemberKick) {
      throw new Error('Cannot find executor or target from the Audit Log.');
    }

    if (target.id === member.user.id) {
      console.log(
        `${member.user.username} was kicked from ${member.guild.name}.`,
      );

      const executingMember = await member.guild.members.fetch(executor.id);
      const modLog = await getTextChannelFromID(member.guild, 'modLog');

      const kickEmbed = new ModerationEmbedBuilder({
        target: member.user,
        executor: executingMember,
        action: 'kick',
        reason: reason,
      });

      modLog.send({ embeds: [kickEmbed] });
    }
  } catch (err) {
    return handleEventError({
      err,
      client: member.client,
      guild: member.guild,
      message: `Failed to log the leaving/kick of ${member.user.username}.`,
    });
  }
});
