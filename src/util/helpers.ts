import { ApplicationCommandOptionChoiceData, Guild, GuildMember, PartialGuildMember, time, } from 'discord.js';
import { config } from '../config';
import axios from "axios";
import { ModerationEmbedBuilder, ModerationEmbedOptions } from "../classes/ModerationEmbedBuilder";
import { getTextChannelFromID } from "./loggers";
import { getForkedServices } from '../index';
import { WhitelistTask } from '../role-whitelist/entities/whitelist-task.entity';
import { OperatorTask } from '../role-whitelist/entities/operator-task.entity';

export async function purgeScheduledTasks(predicate: (task: WhitelistTask | OperatorTask) => boolean): Promise<string[]> {
  const db = await getForkedServices();

  const [whitelistTasks, operatorTasks] = await Promise.all([db.whitelistTask.findAll(), db.operatorTask.findAll()]);

  const purgedTasks = [];
  for (const task of [...whitelistTasks, ...operatorTasks]) {
    if (predicate(task)) {
      purgedTasks.push(JSON.stringify({
        id: task.id, ign: task.ign, operation: task.operation,
        server: task.server.name, attempts: task.attempts,
        type: task instanceof WhitelistTask ? 'whitelist' : 'operator'
      }));
      db.em.remove(task);
    }
  }

  await db.em.flush();

  return purgedTasks;
}

export async function getUsers(executorId: string, targetId: string | null, guild: Guild): Promise<{
  executor: GuildMember | undefined,
  target: GuildMember | undefined
}> {
  const users = await guild.members.fetch({
    user: targetId ? [executorId, targetId] : executorId
  });
  const executor = users.get(executorId);
  const target = targetId ? users.get(targetId) : undefined;
  return { executor, target };
}

export async function sendEmbedToModLogs(options: ModerationEmbedOptions, guild: Guild) {
  options.isMemberModLog = false;
  const modLog = await getTextChannelFromID(guild, 'modLog');
  modLog.send({ embeds: [new ModerationEmbedBuilder(options)] });

  options.isMemberModLog = true;
  const memberModLog = await getTextChannelFromID(guild, 'memberModLog');
  memberModLog.send({ embeds: [new ModerationEmbedBuilder(options)] });
}

export function getAsJsonIfObject(maybeObject: unknown): string {
  if (typeof maybeObject === 'object') {
    return JSON.stringify(maybeObject);
  } else {
    return maybeObject === undefined ? '' : maybeObject.toString();
  }
}

export function getServerChoices(): ApplicationCommandOptionChoiceData<string>[] {
  const choices = [];

  for (const server of Object.keys(config.mcConfig)) {
    choices.push({ name: server, value: server });
  }

  return choices;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return bytes + ' bytes';
  } else if (bytes < 1024 ** 2) {
    return (bytes / 1024).toFixed(1) + ' KB';
  } else if (bytes < 1024 ** 3) {
    return (bytes / 1024 ** 2).toFixed(1) + ' MB';
  } else if (bytes < 1024 ** 4) {
    return (bytes / 1024 ** 3).toFixed(1) + ' GB';
  } else {
    return (bytes / 1024 ** 4).toFixed(1) + ' TB';
  }
}

export function capitalizeFirstLetter(string: string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

export function getJoinedAtComponent(
  member: GuildMember | PartialGuildMember,
): string {
  return member.joinedAt
    ? `\nJoined at: ${time(member.joinedAt, 'f')} (${time(
        member.joinedAt,
        'R',
      )})`
    : '\u200b';
}

export async function getCanonicalIGN(ign: string): Promise<string | null> {
  try {
    const { data } = await axios.get("https://api.minecraftservices.com/minecraft/profile/lookup/name/" + ign);
    return typeof data.name == "string" ? data.name : "";
  } catch (err) {
    return axios.isAxiosError(err) && err.response && err.response.status == 404 ? "" : null;
  }
}
