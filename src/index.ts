import { GatewayIntentBits, Partials } from 'discord.js';
import { ExtendedClient } from 'djs-handlers';
import { config, projectPaths } from './config';
import { EntityManager, EntityRepository, MikroORM, Options } from "@mikro-orm/sqlite";
import ormConfig from './mikro-orm.config.js';
import { User } from "./role-whitelist/entities/user.entity";
import { Role } from "./role-whitelist/entities/role.entity";
import { MinecraftServer } from "./role-whitelist/entities/minecraft-server.entity";
import { WhitelistTask } from "./role-whitelist/entities/whitelist-task.entity";
import { Cron } from "croner";
import { runScheduledTasks as runWhitelistTasks } from "./role-whitelist/handlers/whitelist-handler";
import { runScheduledTasks as runOperatorTasks } from "./role-whitelist/handlers/operator-handler";
import { diffRolesOnInit } from "./role-whitelist/handlers/role-change-handler";
import { OperatorTask } from "./role-whitelist/entities/operator-task.entity";

export const client = new ExtendedClient({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildEmojisAndStickers,
  ],
  partials: [Partials.GuildMember],
});

client.start({
  botToken: config.bot.token,
  guildID: config.bot.guildID,
  commandsPath: projectPaths.commands,
  eventsPath: projectPaths.events,
  type: 'commonJS',
  globalCommands: false,
  registerCommands: true,
}).then(() => onInit());

export interface Services {
  orm: MikroORM;
  em: EntityManager;
  user: EntityRepository<User>;
  role: EntityRepository<Role>;
  server: EntityRepository<MinecraftServer>;
  whitelistTask: EntityRepository<WhitelistTask>;
  operatorTask: EntityRepository<OperatorTask>;
}

let ormCache: MikroORM;

export async function initORM(options?: Options): Promise<MikroORM> {
  if (ormCache) {
    return ormCache;
  }

  // allow overriding config options for testing
  const orm = await MikroORM.init({
    ...ormConfig,
    ...options,
  });

  await orm.migrator.up();

  // save to cache before returning
  return ormCache = orm;
}

export async function getForkedServices(): Promise<Services> {
  const orm = await initORM();

  const em = orm.em.fork();

  return {
    orm,
    em: em,
    user: em.getRepository(User),
    role: em.getRepository(Role),
    server: em.getRepository(MinecraftServer),
    whitelistTask: em.getRepository(WhitelistTask),
    operatorTask: em.getRepository(OperatorTask),
  };
}

const initRunScheduledTasksJob = () => new Cron('0 * * * *', async () => {
  await runWhitelistTasks();
  await runOperatorTasks();
});

const onInit = async () => {
  await diffRolesOnInit();

  initRunScheduledTasksJob();
};
