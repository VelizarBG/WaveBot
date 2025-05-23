import { ApplicationCommandOptionType, inlineCode, } from 'discord.js';
import { Command } from 'djs-handlers';
import { handleInteractionError } from '../util/loggers';
import { handleUserRoleChange } from "../role-whitelist/handlers/role-change-handler";
import { getForkedServices } from "../index";
import { getCanonicalIGN } from "../util/helpers";

export default new Command({
  name: 'setign',
  description: 'Set the IGN of a user.',
  options: [
    {
      name: 'user',
      description: 'The user.',
      type: ApplicationCommandOptionType.User,
      required: true,
    },
    {
      name: 'ign',
      description: 'The IGN of the user.',
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],
  execute: async ({ interaction, args }) => {
    await interaction.deferReply({ ephemeral: true });

    if (!interaction.guild) {
      return interaction.editReply('This command can only be used in a guild.');
    }

    const discordUser = args.getUser('user');
    let ign = args.getString('ign');

    if (!discordUser || !ign) {
      return interaction.editReply('Missing arguments for this command!');
    }

    if (ign.length > 16) {
      return interaction.editReply("The IGN can't be longer than 16 characters!");
    }

    ign = await getCanonicalIGN(ign);
    switch (ign) {
      case null:
        return interaction.editReply("Could not verify whether that player exists!");
      case "":
        return interaction.editReply("That player does not exist!");
    }

    try {
      const db = await getForkedServices();

      if (await db.user.count({ ign: { $eq: ign } }) > 0) {
        return interaction.editReply("This IGN is already used!");
      }

      const user = await db.user.findOne(discordUser.id);
      if (!user) {
        return interaction.editReply(`User ${inlineCode(discordUser.username)} is not in the database!`);
      }

      const roles = user.roles.map(r => r.id);

      let removeFeedback;
      if (user.ign) {
        interaction.editReply(`Trying to remove ${inlineCode(user.ign)}...`).then();

        removeFeedback = await handleUserRoleChange(user.id, roles, [], db);
      }

      user.ign = ign;

      interaction.editReply(`Trying to add ${inlineCode(ign)}...`).then();

      const addFeedback = await handleUserRoleChange(user.id, [], roles, db);

      await db.em.flush();

      return interaction.editReply(`Successfully set the IGN of ${
        inlineCode(discordUser.username)} to ${inlineCode(ign)}!\n\n${
        removeFeedback ? removeFeedback + "\n\n" : ""}${addFeedback}`);
    } catch (err) {
      return handleInteractionError({
        interaction,
        err,
        message: `Error while changing the IGN of ${inlineCode(discordUser.username)}!`,
      });
    }
  },
});
