import {
  ApplicationCommandOptionChoiceData,
  GuildMember,
  PartialGuildMember,
  time,
} from 'discord.js';
import { config } from '../config';
import axios from "axios";

export function getServerChoices(): ApplicationCommandOptionChoiceData<string>[] {
  const choices = [];

  for (const server of Object.keys(config.mcConfig)) {
    choices.push({ name: server, value: server });
  }

  return choices;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return bytes + ' bytes';
  } else if (bytes < 1024 ** 2) {
    return (bytes / 1024).toFixed(1) + ' KB';
  } else if (bytes < 1024 ** 3) {
    return (bytes / 1024 ** 2).toFixed(1) + ' MB';
  } else if (bytes < 1024 ** 4) {
    return (bytes / 1024 ** 3).toFixed(1) + ' GB';
  } else {
    return (bytes / 1024 ** 4).toFixed(1) + ' TB';
  }
}

export function capitalizeFirstLetter(string: string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

export function getJoinedAtComponent(
  member: GuildMember | PartialGuildMember,
): string {
  return member.joinedAt
    ? `\nJoined at: ${time(member.joinedAt, 'f')} (${time(
        member.joinedAt,
        'R',
      )})`
    : '\u200b';
}

export async function getCanonicalIGN(ign: string): Promise<string | null> {
  try {
    const { data } = await axios.get("https://api.minecraftservices.com/minecraft/profile/lookup/name/" + ign);
    return typeof data.name == "string" ? data.name : "";
  } catch (err) {
    return axios.isAxiosError(err) && err.response && err.response.status == 404 ? "" : null;
  }
}
