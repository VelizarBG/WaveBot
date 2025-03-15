import { Operation } from "./operation";
import { WhitelistTask } from "../entities/whitelist-task.entity";
import { initORM, Services } from "../../index";
import { runRconCommand } from "../../util/rcon";
import { setTimeout } from "timers/promises";

export async function handleWhitelistTask(task: WhitelistTask, db: Services): Promise<boolean> {
  if (!await executeWhitelistTask(task)) {
    db.whitelistTask.create(task);
    return false;
  }
  return true;
}

export async function runScheduledTasks() {
  const db = await initORM();

  const tasks = await db.whitelistTask.findAll();

  let successfulTasks = 0;
  for (const task of tasks) {
    if (await executeWhitelistTask(task)) {
      db.em.remove(task);
      successfulTasks += 1;
    }
  }

  if (tasks.length > 0) {
    console.log(`Successfully executed ${successfulTasks} out of ${tasks.length} scheduled whitelist tasks!`)
  }

  await db.em.flush();
}

async function executeWhitelistTask(task: WhitelistTask): Promise<boolean> {
  let subcommand: string;
  let successPattern: RegExp;
  if (task.operation === Operation.ADD) {
    subcommand = "add";
    successPattern = /Added .* to the whitelist|Player is already whitelisted/;
  } else if (task.operation === Operation.REMOVE) {
    subcommand = "remove";
    successPattern = /Removed .* from the whitelist|Player is not whitelisted/;
  } else {
    return false;
  }

  task.attempts += 1;

  const server = task.server;
  const whitelistCommand = `whitelist ${subcommand} ${task.ign}`;

  let attemptsLeft = 5;
  while (attemptsLeft > 0) {
    attemptsLeft--;

    const feedback = await runRconCommand(
      server.host,
      server.rconPort,
      server.rconPassword,
      whitelistCommand,
    ).catch(err => {
      console.error("Error white executing whitelist task: ", err);
      return "";
    });

    if (successPattern.test(feedback)) {
      return true;
    }

    await setTimeout(1000);
  }

  return false;
}
