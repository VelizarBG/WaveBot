import { ApplicationCommandOptionType, inlineCode, } from 'discord.js';
import { Command } from 'djs-handlers';
import { handleInteractionError } from '../util/loggers';
import { getForkedServices } from "../index";

export default new Command({
  name: 'getign',
  description: 'Get the IGN of a user.',
  options: [
    {
      name: 'user',
      description: 'The user.',
      type: ApplicationCommandOptionType.User,
      required: true,
    },
  ],
  execute: async ({ interaction, args }) => {
    await interaction.deferReply({ ephemeral: true });

    if (!interaction.guild) {
      return interaction.editReply('This command can only be used in a guild.');
    }

    const discordUser = args.getUser('user');

    if (!discordUser) {
      return interaction.editReply('Missing arguments for this command!');
    }

    const formattedName = inlineCode(discordUser.username);
    try {
      const db = await getForkedServices();

      const user = await db.user.findOne(discordUser.id);
      if (!user) {
        return interaction.editReply(`User ${formattedName} is not in the database!`);
      }

      if (!user.ign) {
        return interaction.editReply(`User ${formattedName} does not have an IGN.`);
      }

      return interaction.editReply(`The IGN of ${formattedName} is ${inlineCode(user.ign)}.`);
    } catch (err) {
      return handleInteractionError({
        interaction,
        err,
        message: `Error while getting the IGN of ${formattedName}!`,
      });
    }
  },
});
