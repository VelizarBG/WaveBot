import { Operation } from "./operation";
import { WhitelistTask } from "../entities/whitelist-task.entity";
import { getForkedServices, Services } from "../../index";
import { runRconCommand } from "../../util/rcon";
import { setTimeout } from "timers/promises";

export async function handleWhitelistTask(task: WhitelistTask, db: Services): Promise<boolean> {
  return executeWhitelistTask(task).then(isSuccessful => {
    if (!isSuccessful) {
      db.whitelistTask.create(task);
      return false;
    } else {
      return true;
    }
  });
}

export async function runScheduledTasks(): Promise<string> {
  const db = await getForkedServices();

  const tasks = await db.whitelistTask.findAll();

  const taskPromises: Promise<void>[] = [];
  let successfulTasks = 0;
  for (const task of tasks) {
    taskPromises.push(executeWhitelistTask(task).then(isSuccessful => {
      if (isSuccessful) {
        db.em.remove(task);
        successfulTasks += 1;
      }
    }));
  }

  await Promise.all(taskPromises);

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

  const runCommand = (): Promise<boolean> => runRconCommand(
    server.host,
    server.rconPort,
    server.rconPassword,
    whitelistCommand,
  ).then(feedback => {
    if (successPattern.test(feedback)) {
      return true;
    } else {
      attemptsLeft--;
      console.log(`[Whitelist Manager] Could not ${task.operation} whitelist for ${
        task.ign} on ${server.name} (${attemptsLeft} attempts left): ${feedback}`);

      if (attemptsLeft > 0) {
        setTimeout(1000);
        return runCommand();
      } else {
        return false;
      }
    }
  });

  return runCommand();
}
