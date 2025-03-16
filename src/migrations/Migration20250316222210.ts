import { Migration } from '@mikro-orm/migrations';

export class Migration20250316222210 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table \`minecraft_servers\` (\`id\` integer not null primary key autoincrement, \`name\` text not null, \`host\` text not null, \`port\` integer not null, \`rcon_port\` integer not null, \`rcon_password\` text not null);`);

    this.addSql(`create table \`operator_tasks\` (\`id\` integer not null primary key autoincrement, \`ign\` text not null, \`operation\` text check (\`operation\` in ('add', 'remove')) not null, \`server_id\` integer not null, \`attempts\` integer not null default 0, constraint \`operator_tasks_server_id_foreign\` foreign key(\`server_id\`) references \`minecraft_servers\`(\`id\`) on update cascade);`);
    this.addSql(`create index \`operator_tasks_server_id_index\` on \`operator_tasks\` (\`server_id\`);`);

    this.addSql(`create table \`roles\` (\`id\` text not null, primary key (\`id\`));`);

    this.addSql(`create table \`roles_operator_servers\` (\`role_id\` text not null, \`minecraft_server_id\` integer not null, constraint \`roles_operator_servers_role_id_foreign\` foreign key(\`role_id\`) references \`roles\`(\`id\`) on delete cascade on update cascade, constraint \`roles_operator_servers_minecraft_server_id_foreign\` foreign key(\`minecraft_server_id\`) references \`minecraft_servers\`(\`id\`) on delete cascade on update cascade, primary key (\`role_id\`, \`minecraft_server_id\`));`);
    this.addSql(`create index \`roles_operator_servers_role_id_index\` on \`roles_operator_servers\` (\`role_id\`);`);
    this.addSql(`create index \`roles_operator_servers_minecraft_server_id_index\` on \`roles_operator_servers\` (\`minecraft_server_id\`);`);

    this.addSql(`create table \`roles_whitelisted_servers\` (\`role_id\` text not null, \`minecraft_server_id\` integer not null, constraint \`roles_whitelisted_servers_role_id_foreign\` foreign key(\`role_id\`) references \`roles\`(\`id\`) on delete cascade on update cascade, constraint \`roles_whitelisted_servers_minecraft_server_id_foreign\` foreign key(\`minecraft_server_id\`) references \`minecraft_servers\`(\`id\`) on delete cascade on update cascade, primary key (\`role_id\`, \`minecraft_server_id\`));`);
    this.addSql(`create index \`roles_whitelisted_servers_role_id_index\` on \`roles_whitelisted_servers\` (\`role_id\`);`);
    this.addSql(`create index \`roles_whitelisted_servers_minecraft_server_id_index\` on \`roles_whitelisted_servers\` (\`minecraft_server_id\`);`);

    this.addSql(`create table \`users\` (\`id\` text not null, \`ign\` text null, primary key (\`id\`));`);
    this.addSql(`create unique index \`users_ign_unique\` on \`users\` (\`ign\`);`);

    this.addSql(`create table \`roles_users\` (\`role_id\` text not null, \`user_id\` text not null, constraint \`roles_users_role_id_foreign\` foreign key(\`role_id\`) references \`roles\`(\`id\`) on delete cascade on update cascade, constraint \`roles_users_user_id_foreign\` foreign key(\`user_id\`) references \`users\`(\`id\`) on delete cascade on update cascade, primary key (\`role_id\`, \`user_id\`));`);
    this.addSql(`create index \`roles_users_role_id_index\` on \`roles_users\` (\`role_id\`);`);
    this.addSql(`create index \`roles_users_user_id_index\` on \`roles_users\` (\`user_id\`);`);

    this.addSql(`create table \`whitelist_tasks\` (\`id\` integer not null primary key autoincrement, \`ign\` text not null, \`operation\` text check (\`operation\` in ('add', 'remove')) not null, \`server_id\` integer not null, \`attempts\` integer not null default 0, constraint \`whitelist_tasks_server_id_foreign\` foreign key(\`server_id\`) references \`minecraft_servers\`(\`id\`) on update cascade);`);
    this.addSql(`create index \`whitelist_tasks_server_id_index\` on \`whitelist_tasks\` (\`server_id\`);`);
  }

}
