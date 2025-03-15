import { ApplicationCommandOptionType, inlineCode } from 'discord.js';
import { Command } from 'djs-handlers';
import { KoalaEmbedBuilder } from '../classes/KoalaEmbedBuilder';
import { config, ServerChoice } from '../config';
import { getServerChoices } from '../util/helpers';
import { handleInteractionError } from '../util/loggers';
import { getWhitelist } from '../util/rcon';
import { initORM } from "../index";
import { Operation, WhitelistTask } from "../role-whitelist/entities/whitelist-task.entity";
import { handleWhitelistTask } from "../role-whitelist/handlers/whitelist-handler";
import { OperatorTask } from "../role-whitelist/entities/operator-task.entity";
import { handleOperatorTask } from "../role-whitelist/handlers/operator-handler";

export default new Command({
  name: 'whitelist',
  description: 'Get information about the whitelist & add/remove users.',
  options: [
    {
      name: 'add',
      description: 'Adds a player to the whitelist on all minecraft servers.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'ign',
          description: `The player's in-game name.`,
          type: ApplicationCommandOptionType.String,
          required: true,
        },
      ],
    },
    {
      name: 'remove',
      description:
        'Removes a player from the whitelist on all minecraft servers.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'ign',
          description: `The player's in-game name.`,
          type: ApplicationCommandOptionType.String,
          required: true,
          autocomplete: true,
        },
      ],
    },
    {
      name: 'list',
      description: 'Returns the whitelist of the specified server in an embed.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'server',
          description: `Specify a server.`,
          type: ApplicationCommandOptionType.String,
          choices: [...getServerChoices()],
          required: true,
        },
      ],
    },
  ],
  execute: async ({ interaction, args }) => {
    await interaction.deferReply();

    const subcommand = args.getSubcommand();

    if (!subcommand) {
      return interaction.editReply('This subcommand does not exist!');
    }

    if (!interaction.guild) {
      return interaction.reply('This command can only be used in a guild.');
    }

    try {
      if (subcommand === 'list') {
        const choice = args.getString('server', true) as ServerChoice;

        if (!choice) {
          return interaction.editReply('Please specify a server!');
        }

        const { host, rconPort, rconPasswd } = config.mcConfig[choice];

        const response = await getWhitelist(host, rconPort, rconPasswd);

        const whitelist = !response
          ? `There are no whitelisted players on ${choice}!`
          : response.map((ign) => escapeMarkdown(ign)).join('\n');

        const whitelistEmbed = new KoalaEmbedBuilder(interaction.user, {
          title: `${choice.toUpperCase()} Whitelist`,
          description: whitelist,
        });

        const iconURL = interaction.guild.iconURL();

        if (iconURL) {
          whitelistEmbed.setThumbnail(iconURL);
        }

        return interaction.editReply({ embeds: [whitelistEmbed] });
      } else {
        const ign = args.getString('ign');

        if (!ign) {
          return interaction.editReply('Please provide an in-game name!');
        }

        const servers = Object.keys(config.mcConfig);

        const db = await initORM();
        let whitelistServers = 0;
        let opServers = 0;
        let whitelistSuccesses = 0;
        let opSuccesses = 0;
        for await (const server of servers) {
          whitelistServers++;
          const { host, rconPort } =
            config.mcConfig[server as ServerChoice];

          const storedServer = await db.server.findOne(
            { host: { $eq: host }, rconPort: { $eq: rconPort } });

          if (!storedServer) {
            continue;
          }

          const whitelistTask = new WhitelistTask(ign, subcommand === 'add'
            ? Operation.ADD
            : Operation.REMOVE, storedServer
          );
          if (await handleWhitelistTask(whitelistTask, db)) {
            whitelistSuccesses += 1;
          }

          if (config.mcConfig[server as ServerChoice].operator) {
            opServers++;

            const operatorTask = new OperatorTask(ign, subcommand === 'add'
              ? Operation.ADD
              : Operation.REMOVE, storedServer
            );
            if (await handleOperatorTask(operatorTask, db)) {
              opSuccesses += 1;
            }
          }
        }
        const successMessage =
          subcommand === 'add'
            ? `Successfully added ${inlineCode(ign)} to the whitelist on ${
                whitelistSuccesses
              }/${whitelistServers} servers.\nSuccessfully made ${inlineCode(ign)} an operator on ${
                opSuccesses
              }/${opServers} servers.`
            : `Successfully removed ${inlineCode(ign)} from the whitelist on ${
                whitelistSuccesses
              }/${whitelistServers} servers.\nSuccessfully removed ${inlineCode(
                ign,
              )} as an operator on ${opSuccesses}/${opServers} servers.`;

        return interaction.editReply(successMessage);
      }
    } catch (err) {
      return handleInteractionError({
        interaction,
        err,
        message: `There was an error trying to execute the whitlist ${subcommand} command!`,
      });
    }
  },
});

function escapeMarkdown(text: string): string {
  const unescaped = text.replace(/\\(\*|_|`|~|\\)/g, '$1');
  return unescaped.replace(/(\*|_|`|~|\\)/g, '\\$1');
}
