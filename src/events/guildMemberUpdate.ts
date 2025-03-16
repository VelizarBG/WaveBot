import { Event } from 'djs-handlers';
import { handleUserRoleChange } from "../role-whitelist/handlers/role-change-handler";
import { getForkedServices } from "../index";

export default new Event('guildMemberUpdate', async (oldMember, newMember) => {
  const db = await getForkedServices();

  const oldRoles = oldMember.roles.valueOf().keys();
  const newRoles = newMember.roles.valueOf().keys();
  await handleUserRoleChange(newMember.id, oldRoles, newRoles, db);

  await db.em.flush();
});