import { Command } from 'djs-handlers';
import { handleInteractionError } from '../util/loggers';
import { runScheduledTasks as runWhitelistTasks } from "../role-whitelist/handlers/whitelist-handler";
import { runScheduledTasks as runOperatorTasks } from "../role-whitelist/handlers/operator-handler";

export default new Command({
  name: 'runscheduledtasks',
  description: 'Run the scheduled whitelist/operator tasks.',
  execute: async ({ interaction }) => {
    await interaction.deferReply();

    if (!interaction.guild) {
      return interaction.editReply('This command can only be used in a guild.');
    }

    try {
      interaction.editReply('Running whitelist tasks...').then();
      const whitelistFeedback = await runWhitelistTasks();

      interaction.editReply('Running operator tasks...').then();
      const operatorFeedback = await runOperatorTasks();

      return interaction.editReply(whitelistFeedback + '\n' + operatorFeedback);
    } catch (err) {
      return handleInteractionError({
        interaction,
        err,
        message: `Error while running scheduled tasks!`,
      });
    }
  },
});
