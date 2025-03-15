import { inlineCode, Snowflake } from "discord.js";
import { client, initORM, Services } from "../../index";
import { Role } from "../entities/role.entity";
import { User } from "../entities/user.entity";
import { MinecraftServer } from "../entities/minecraft-server.entity";
import { Operation, WhitelistTask } from "../entities/whitelist-task.entity";
import { handleWhitelistTask } from "./whitelist-handler";
import { config } from "../../config";
import { handleOperatorTask } from "./operator-handler";
import { OperatorTask } from "../entities/operator-task.entity";

export async function diffRolesOnInit() {
  const db = await initORM();
  const roles = await db.role.findAll();
  const guild = await client.guilds.fetch(config.bot.guildID);

  await guild.members.fetch();

  const newUsers = new Map<Snowflake, Snowflake[]>();
  for (const role of roles) {
    const discordRole = await guild.roles.fetch(role.id);
    if (discordRole) {
      for (const [userId, member] of discordRole.members) {
        if (!newUsers.has(userId)) {
          newUsers.set(userId, [...member.roles.valueOf().keys()])
        }
      }
    }
  }

  const roleDiffMap = new Map<Snowflake, [Snowflake[], Snowflake[]]>();
  for (const [id, newRoles] of newUsers) {
    roleDiffMap.set(id, [[], newRoles])
  }

  const oldUsers = await db.user.findAll({ where: { roles: { $some: {} } } });
  for (const user of oldUsers) {
    const oldNewPair = roleDiffMap.get(user.id);
    const oldRoles = user.roles.map(r => r.id);
    if (oldNewPair) {
      oldNewPair[0] = oldRoles;
    } else {
      roleDiffMap.set(user.id, [oldRoles, []]);
    }
  }

  for (const [userId, [oldRoles, newRoles]] of roleDiffMap) {
    await handleUserRoleChange(userId, oldRoles, newRoles);
  }
}

export async function handleUserRoleChange(userId: Snowflake, oldRoles: Iterable<Snowflake>, newRoles: Iterable<Snowflake>): Promise<string> {
  const db = await initORM();

  const feedback = await handleUserRoleChangeInner(userId, new Set(oldRoles), new Set(newRoles), db);

  await db.em.flush();

  /*client.guilds.fetch(config.bot.guildID)
    .then(guild => getTextChannelFromID(guild, 'modLog'))
    .then(modLog => modLog.send({ content: feedback }));*/

  console.log('[Whitelist Manager] ' + feedback);
  return feedback;
}

async function handleUserRoleChangeInner(userId: Snowflake, oldRoles: Set<Snowflake>, newRoles: Set<Snowflake>, db: Services): Promise<string> {
  const addedRoles = new Set<Snowflake>();
  for (const newRole of newRoles) {
    if (!oldRoles.has(newRole)) {
      addedRoles.add(newRole);
    }
  }

  const removedRoles = new Set<Snowflake>();
  for (const oldRole of oldRoles) {
    if (!newRoles.has(oldRole)) {
      removedRoles.add(oldRole);
    }
  }

  if (addedRoles.size == 0 && removedRoles.size == 0) {
    return `User ${inlineCode(userId)} has no role changes!`;
  }

  const roles = await db.role.findAll();

  const rolesToAdd = new Set<Role>();
  const rolesToRemove = new Set<Role>();
  for (const role of roles) {
    if (addedRoles.has(role.id)) {
      rolesToAdd.add(role);
      continue;
    }
    if (removedRoles.has(role.id)) {
      rolesToRemove.add(role);
    }
  }

  if (rolesToAdd.size == 0 && rolesToRemove.size == 0) {
    return `User ${inlineCode(userId)} has no significant role changes!`;
  }

  let user = await db.user.findOne(userId);

  if (!user) {
    user = new User(userId);
    db.user.create(user);
  }

  for (const role of rolesToRemove) {
    user.roles.remove(role);
  }

  for (const role of rolesToAdd) {
    user.roles.add(role);
  }

  if (!user.ign) {
    return `User ${inlineCode(user.id)} does not have an IGN.`;
  }

  await db.role.populate([...rolesToAdd, ...rolesToRemove], ['whitelistedServers', 'operatorServers']);

  const whitelistFeedback = await handleWhitelist(rolesToAdd, rolesToRemove, user.ign, db);

  const operatorFeedback = await handleOperator(rolesToAdd, rolesToRemove, user.ign, db);

  return new WhitelistOperatorFeedback(whitelistFeedback, operatorFeedback).createFeedbackMessage(user.ign);
}

async function handleWhitelist(rolesToAdd: Set<Role>, rolesToRemove: Set<Role>, ign: string, db: Services): Promise<WhitelistFeedback> {
  const serversToWhitelist = new Set<MinecraftServer>();
  for (const role of rolesToAdd) {
    for (const server of role.whitelistedServers) {
      serversToWhitelist.add(server);
    }
  }

  const serversToUnwhitelist = new Set<MinecraftServer>();
  for (const role of rolesToRemove) {
    for (const server of role.whitelistedServers) {
      if (!serversToWhitelist.has(server)) {
        serversToUnwhitelist.add(server);
      }
    }
  }

  const feedback = {
    whitelistFeedback: {
      add: {
        successful: 0,
        total: serversToWhitelist.size,
      },
      remove: {
        successful: 0,
        total: serversToUnwhitelist.size,
      }
    }
  };

  for (const server of serversToWhitelist) {
    if (await handleWhitelistTask(new WhitelistTask(ign, Operation.ADD, server), db)) {
      feedback.whitelistFeedback.add.successful += 1;
    }
  }

  for (const server of serversToUnwhitelist) {
    if (await handleWhitelistTask(new WhitelistTask(ign, Operation.REMOVE, server), db)) {
      feedback.whitelistFeedback.remove.successful += 1;
    }
  }

  return feedback;
}

async function handleOperator(rolesToAdd: Set<Role>, rolesToRemove: Set<Role>, ign: string, db: Services): Promise<OperatorFeedback> {
  const serversToOp = new Set<MinecraftServer>();
  for (const role of rolesToAdd) {
    for (const server of role.operatorServers) {
      serversToOp.add(server);
    }
  }

  const serversToDeop = new Set<MinecraftServer>();
  for (const role of rolesToRemove) {
    for (const server of role.operatorServers) {
      if (!serversToOp.has(server)) {
        serversToDeop.add(server);
      }
    }
  }

  const feedback = {
    operatorFeedback: {
      add: {
        successful: 0,
        total: serversToOp.size,
      },
      remove: {
        successful: 0,
        total: serversToDeop.size,
      }
    }
  };

  for (const server of serversToOp) {
    if (await handleOperatorTask(new OperatorTask(ign, Operation.ADD, server), db)) {
      feedback.operatorFeedback.add.successful += 1;
    }
  }

  for (const server of serversToDeop) {
    if (await handleOperatorTask(new OperatorTask(ign, Operation.REMOVE, server), db)) {
      feedback.operatorFeedback.remove.successful += 1;
    }
  }

  return feedback;
}

export class WhitelistOperatorFeedback implements WhitelistFeedback, OperatorFeedback {
  whitelistFeedback!: AddRemoveFeedback;
  operatorFeedback!: AddRemoveFeedback;

  createFeedbackMessage(ign: string): string {
    ign = inlineCode(ign);
    let message = "";

    if (this.whitelistFeedback.add.total > 0) {
      message += `Successfully added ${ign} to the whitelist on ${
      this.whitelistFeedback.add.successful}/${this.whitelistFeedback.add.total} servers.`;
    }

    if (this.whitelistFeedback.remove.total > 0) {
      if (message.length > 0) message += '\n';
      message += `Successfully removed ${ign} from the whitelist on ${
        this.whitelistFeedback.remove.successful}/${this.whitelistFeedback.remove.total} servers.`;
    }

    if (this.operatorFeedback.add.total > 0) {
      message += `Successfully made ${ign} an operator on ${
        this.operatorFeedback.add.successful}/${this.operatorFeedback.add.total} servers.`;
    }

    if (this.operatorFeedback.remove.total > 0) {
      if (message.length > 0) message += '\n';
      message += `Successfully removed ${ign} as an operator on ${
        this.operatorFeedback.remove.successful}/${this.operatorFeedback.remove.total} servers.`;
    }

    if (message.length == 0) {
      message = `No operation has been taken for ${ign}.`;
    }

    return message;
  }

  constructor(whitelistFeedback?: WhitelistFeedback, operatorFeedback?: OperatorFeedback) {
    this.whitelistFeedback = whitelistFeedback
      ? whitelistFeedback.whitelistFeedback
      : { add: { successful: 0, total: 0 }, remove: { successful: 0, total: 0 } };
    this.operatorFeedback = operatorFeedback
      ? operatorFeedback.operatorFeedback
      : { add: { successful: 0, total: 0 }, remove: { successful: 0, total: 0 } };
  }
}

export interface WhitelistFeedback {
  whitelistFeedback: AddRemoveFeedback
}

export interface OperatorFeedback {
  operatorFeedback: AddRemoveFeedback
}

export interface AddRemoveFeedback {
  add: {
    successful: number,
    total: number,
  };
  remove: {
    successful: number,
    total: number,
  }
}
