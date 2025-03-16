import { Operation } from "./operation";
import { WhitelistTask } from "../entities/whitelist-task.entity";
import { getForkedServices, Services } from "../../index";
import { runRconCommand } from "../../util/rcon";
import { setTimeout } from "timers/promises";

export async function handleWhitelistTask(task: WhitelistTask, db: Services): Promise<boolean> {
  if (!await executeWhitelistTask(task)) {
    db.whitelistTask.create(task);
    return false;
  }
  return true;
}

export async function runScheduledTasks(): Promise<string> {
  const db = await getForkedServices();

  const tasks = await db.whitelistTask.findAll();

  let successfulTasks = 0;
  for (const task of tasks) {
    if (await executeWhitelistTask(task)) {
      db.em.remove(task);
      successfulTasks += 1;
    }
  }

  let feedback;
  if (tasks.length > 0) {
    feedback = `Successfully executed ${successfulTasks} out of ${tasks.length} scheduled whitelist tasks!`;
    console.log(feedback)
  } else {
    feedback = 'There were no scheduled whitelist tasks.';
  }

  await db.em.flush();

  return feedback;
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
    );

    if (successPattern.test(feedback)) {
      return true;
    } else {
      console.log(`[Whitelist Manager] Could not whitelist ${
        task.ign} (${attemptsLeft} attempts left): ${feedback}`);
    }

    await setTimeout(1000);
  }

  return false;
}
