import { Operation } from "./operation";
import { initORM, Services } from "../../index";
import { runRconCommand } from "../../util/rcon";
import { setTimeout } from "timers/promises";
import { OperatorTask } from "../entities/operator-task.entity";

export async function handleOperatorTask(task: OperatorTask, db: Services): Promise<boolean> {
  if (!await executeOperatorTask(task)) {
    db.operatorTask.create(task);
    return false;
  }
  return true;
}

export async function runScheduledTasks(): Promise<string> {
  const db = await initORM();

  const tasks = await db.operatorTask.findAll();

  let successfulTasks = 0;
  for (const task of tasks) {
    if (await executeOperatorTask(task)) {
      db.em.remove(task);
      successfulTasks += 1;
    }
  }

  let feedback;
  if (tasks.length > 0) {
    feedback = `Successfully executed ${successfulTasks} out of ${tasks.length} scheduled operator tasks!`;
    console.log(feedback)
  } else {
    feedback = 'There were no scheduled operator tasks.';
  }

  await db.em.flush();

  return feedback;
}

async function executeOperatorTask(task: OperatorTask): Promise<boolean> {
  let command: string;
  let successPattern: RegExp;
  if (task.operation === Operation.ADD) {
    command = "op";
    successPattern = /Made .* a server operator|Nothing changed. The player already is an operator/;
  } else if (task.operation === Operation.REMOVE) {
    command = "deop";
    successPattern = /Made .* no longer a server operator|Nothing changed. The player is not an operator/;
  } else {
    return false;
  }

  task.attempts += 1;

  const server = task.server;
  const operatorCommand = `${command} ${task.ign}`;

  let attemptsLeft = 5;
  while (attemptsLeft > 0) {
    attemptsLeft--;

    const feedback = await runRconCommand(
      server.host,
      server.rconPort,
      server.rconPassword,
      operatorCommand,
    );

    if (successPattern.test(feedback)) {
      return true;
    }

    await setTimeout(1000);
  }

  return false;
}
