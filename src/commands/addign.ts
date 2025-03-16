import { ApplicationCommandOptionType, inlineCode, } from 'discord.js';
import { Command } from 'djs-handlers';
import { handleInteractionError } from '../util/loggers';
import { handleUserRoleChange } from "../role-whitelist/handlers/role-change-handler";
import { getForkedServices } from "../index";

export default new Command({
  name: 'addign',
  description: 'Saves your IGN and whitelists you to the servers you have access to.',
  options: [
    {
      name: 'ign',
      description: 'Your in-game name.',
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],
  execute: async ({ interaction, args }) => {
    await interaction.deferReply({ ephemeral: true });

    if (!interaction.guild) {
      return interaction.editReply('This command can only be used in a guild.');
    }

    const ign = args.getString('ign');

    if (!ign) {
      return interaction.editReply('Missing arguments for this command!');
    }

    if (ign.length > 16) {
      return interaction.editReply("Your IGN can't be longer than 16 characters!");
    }

    try {
      const db = await getForkedServices();

      if (await db.user.count({ ign: { $eq: ign } }) > 0) {
        return interaction.editReply("This IGN is already used by someone else!");
      }

      const user = await db.user.findOne(interaction.member.id);
      if (user) {
        if (user.ign) {
          return interaction.editReply("Your IGN is already set! Contact an Admin if you want to change it.");
        } else {
          user.ign = ign;
        }
      }

      interaction.editReply(`Trying to whitelist ${inlineCode(ign)}...`).then();

      const feedback = await handleUserRoleChange(interaction.member.id, [], interaction.member.roles.valueOf().keys(), db);

      await db.em.flush();

      return interaction.editReply(feedback);
    } catch (err) {
      return handleInteractionError({
        interaction,
        err,
        message: `Error while whitelisting ${inlineCode(ign)}! Please report this to an Admin immediately!`,
      });
    }
  },
});
