import { Collection, Entity, ManyToMany, PrimaryKey } from "@mikro-orm/sqlite";
import { Snowflake } from "discord.js";
import { User } from "./user.entity";
import { MinecraftServer } from "./minecraft-server.entity";

@Entity({ tableName: "roles" })
export class Role {
  @PrimaryKey({ type: 'string' })
  id: Snowflake;

  @ManyToMany({ entity: () => User, eager: false })
  users = new Collection<User>(this);

  @ManyToMany({ entity: () => MinecraftServer, eager: false })
  whitelistedServers = new Collection<MinecraftServer>(this);

  @ManyToMany({ entity: () => MinecraftServer, eager: false })
  operatorServers = new Collection<MinecraftServer>(this);

  constructor(id: Snowflake) {
    this.id = id;
  }
}
