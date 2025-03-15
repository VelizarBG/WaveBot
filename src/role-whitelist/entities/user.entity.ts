import { Collection, Entity, ManyToMany, PrimaryKey, Property } from "@mikro-orm/sqlite";
import { Snowflake } from "discord.js";
import { Role } from "./role.entity";

@Entity({ tableName: "users" })
export class User {
  @PrimaryKey({ type: 'string' })
  id: Snowflake;

  @Property({ length: 16, unique: true, nullable: true, })
  ign?: string;

  @ManyToMany({ entity: () => Role, mappedBy: "users", eager: true })
  roles = new Collection<Role>(this);

  constructor(id: Snowflake) {
    this.id = id;
  }
}
