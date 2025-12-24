import {
  EmbedBuilder,
  escapeMarkdown,
  GuildMember,
  inlineCode,
  User,
} from 'discord.js';
import { config } from '../config';

export type EmbedAction =
  'kick'
  | 'ban'
  | 'unban'
  | 'timeout'
  | 'remove timeout'
  | 'create role'
  | 'delete role'
  | 'update role'
  | 'give/take roles'
  | 'delete message'

interface ModerationDescription {
  member?: string;
  action: string;
  reason?: string;
  expiration?: string;
  extra?: string;
}

export interface ModerationEmbedOptions {
  target?: User;
  executor: GuildMember;
  action: EmbedAction;
  reason?: string | null;
  expiration?: number | null;
  extra?: string | null;
  isMemberModLog?: boolean;
}

export class ModerationEmbedBuilder extends EmbedBuilder {
  constructor(options: ModerationEmbedOptions) {
    super();

    const { target, executor, action, reason, expiration, extra, isMemberModLog } = options;

    const descriptionObject: ModerationDescription = {
      action: `**Action**: ${action}`,
    };

    if (target) {
      descriptionObject.member = `**Member**: ${escapeMarkdown(target.username)} (${inlineCode(
        target.id,
      )})`;
    }

    if (reason) {
      descriptionObject.reason = `**Reason**: ${reason}`;
    }

    if (expiration) {
      descriptionObject.expiration = `**Expiration**: ${expiration}`;
    }

    if (extra) {
      descriptionObject.extra = extra;
    }

    const description = Object.values(descriptionObject).join('\n');

    let color: number;

    switch (action) {
      case 'remove timeout':
      case 'create role':
        color = config.embedColors.green;
        break;
      case 'update role':
      case 'give/take roles':
        color = config.embedColors.yellow;
        break;
      case 'kick':
      case 'timeout':
      case 'delete message':
        color = config.embedColors.orange;
        break;
      case 'ban':
      case 'delete role':
        color = config.embedColors.red;
        break;
      case 'unban':
        color = config.embedColors.none;
        break;

      default:
        color = config.embedColors.none;
    }

    this.setColor(color);

    this.setAuthor({
      name: escapeMarkdown(executor.user.username),
      iconURL: executor.user.displayAvatarURL(),
    });

    this.setDescription(description);

    this.setFooter({
      text: `${isMemberModLog ? 'Member' : ''} Moderation Log`,
    });

    this.setTimestamp(Date.now());
  }
}
