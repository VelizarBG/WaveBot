import { Command } from 'djs-handlers';
import { handleInteractionError } from '../util/loggers';
import { purgeScheduledTasks } from '../util/helpers';
import { ApplicationCommandOptionType } from 'discord.js';

export default new Command({
  name: 'purgetasksofign',
  description: 'Purge scheduled whitelist/operator tasks of the specified player (case insensitive).',
  options: [
    {
      name: 'ign',
      description: 'The IGN of the player.',
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],
  execute: async ({ interaction, args }) => {
    await interaction.deferReply();

    if (!interaction.guild) {
      return interaction.editReply('This command can only be used in a guild.');
    }

    let ign = args.getString('ign');

    if (!ign) {
      return interaction.editReply('Missing arguments for this command!');
    }

    ign = ign.toLowerCase();

    try {
      interaction.editReply(`Purging tasks of player '${ign}'...`).then();

      const purgedTasks = await purgeScheduledTasks(task => task.ign.toLowerCase() === ign);

      let msg: string;
      if (purgedTasks.length > 0) {
        msg = 'The following tasks were purged:\n' + purgedTasks.join('\n');
        console.log(msg);
      } else {
        msg = 'No tasks were purged.';
      }

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
