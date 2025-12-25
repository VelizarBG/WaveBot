import { RCON } from 'minecraft-server-util';

export const runRconCommand = async (
  host: string,
  rconPort: number,
  rconPassword: string,
  command: string,
) => {
  const rconClient: RCON = new RCON();

  return rconClient.connect(host, rconPort)
    .then(() => rconClient.login(rconPassword))
    .then(() => rconClient.execute(command))
    .then((res) => {
      rconClient.close();
      return res;
    }).catch((error) => {
      console.log('=== RCON ERROR ===');
      console.log(error);
      if (error instanceof Error) {
        console.dir(error.stack);
      }
      return '';
    });
};

export const getWhitelist = async (
  host: string,
  rconPort: number,
  rconPasswd: string,
) => {
  const response = await runRconCommand(
    host,
    rconPort,
    rconPasswd,
    'whitelist list',
  );

  const noWhitelist = 'There are no whitelisted players';

  if (response === noWhitelist) {
    return [];
  }

  const splitResponse = response.split(': ')[1];

  if (!splitResponse) {
    throw new Error('Failed to parse the response correctly!');
  }

  return splitResponse
    .split(', ')
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
};
