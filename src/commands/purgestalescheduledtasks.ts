import { Command } from 'djs-handlers';
import { handleInteractionError } from '../util/loggers';
import { purgeScheduledTasks } from '../util/helpers';

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

      const purgedTasks = await purgeScheduledTasks(task => task.attempts > 100);

      const msg = 'The following tasks were purged:' + purgedTasks.join('\n');
      console.log(msg);

      return await interaction.editReply(msg);
    } catch (err) {
      return handleInteractionError({
        interaction,
        err,
        message: `Error while running scheduled tasks!`,
      });
    }
  },
});
