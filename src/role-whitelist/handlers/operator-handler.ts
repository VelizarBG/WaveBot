import { Operation } from "./operation";
import { getForkedServices, Services } from "../../index";
import { runRconCommand } from "../../util/rcon";
import { setTimeout } from "timers/promises";
import { OperatorTask } from "../entities/operator-task.entity";

export async function handleOperatorTask(task: OperatorTask, db: Services): Promise<boolean> {
  return executeOperatorTask(task).then(isSuccessful => {
    if (!isSuccessful) {
      db.operatorTask.create(task);
      return false;
    } else {
      return true;
    }
  }).catch(reason => {
    db.operatorTask.create(task);
    console.log('[Whitelist Manager] Could not execute operator task: ' + reason);
    return false;
  });
}

export async function runScheduledTasks(): Promise<string> {
  const db = await getForkedServices();

  const tasks = await db.operatorTask.findAll();

  const taskPromises: Promise<void>[] = [];
  let successfulTasks = 0;
  for (const task of tasks) {
    taskPromises.push(executeOperatorTask(task).then(isSuccessful => {
      if (isSuccessful) {
        db.em.remove(task);
        successfulTasks += 1;
      }
    }).catch(reason => {
      console.log('[Whitelist Manager] Could not execute operator task: ' + reason);
    }));
  }

  await Promise.all(taskPromises);

  let feedback;
  if (tasks.length > 0) {
    feedback = `Successfully executed ${successfulTasks} out of ${tasks.length} scheduled operator tasks!`;
    console.log(feedback);
  } else {
    feedback = 'There were no scheduled operator tasks.';
  }

  await db.em.flush();

  return feedback;
}

async function executeOperatorTask(task: OperatorTask): Promise<boolean> {
  return new Promise((resolve, reject) => {
    try {
      resolve(executeOperatorTaskInner(task))
    } catch (e: unknown) {
      reject(e)
    }
  });
}

async function executeOperatorTaskInner(task: OperatorTask): Promise<boolean> {
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

  const runCommand = (): Promise<boolean> => runRconCommand(
    server.host,
    server.rconPort,
    server.rconPassword,
    operatorCommand,
  ).then(feedback => {
    if (successPattern.test(feedback)) {
      return true;
    } else {
      attemptsLeft--;
      console.log(`[Whitelist Manager] Could not ${task.operation} operator for ${
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
