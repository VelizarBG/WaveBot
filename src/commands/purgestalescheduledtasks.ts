import { Command } from 'djs-handlers';
import { handleInteractionError } from '../util/loggers';
import { getForkedServices } from '../index';

export default new Command({
  name: 'purgestalescheduledtasks',
  description: 'Purge stale (>100 attempts) scheduled whitelist/operator tasks.',
  execute: async ({ interaction }) => {
    await interaction.deferReply();

    if (!interaction.guild) {
      return interaction.editReply('This command can only be used in a guild.');
    }

    try {
      interaction.editReply('Purging stale tasks...').then();

      const db = await getForkedServices();

      const [whitelistTasks, operatorTasks] = await Promise.all([db.whitelistTask.findAll(), db.operatorTask.findAll()]);

      const purgedTasks = [];
      for (const task of [...whitelistTasks, ...operatorTasks]) {
        if (task.attempts > 100) {
          purgedTasks.push(JSON.stringify({
            id: task.id, ign: task.ign, operation: task.operation,
            server: task.server.name, attempts: task.attempts
          }));
          db.em.remove(task);
        }
      }

      await db.em.flush();

      const msg = 'The following tasks were purged:' + purgedTasks.join('\n');
      console.log(msg);

      return interaction.editReply(msg);
    } catch (err) {
      return handleInteractionError({
        interaction,
        err,
        message: `Error while running scheduled tasks!`,
      });
    }
  },
});
