import { Collection, Entity, ManyToMany, PrimaryKey, Property } from "@mikro-orm/sqlite";
import { Role } from "./role.entity";

@Entity({ tableName: "minecraft_servers" })
export class MinecraftServer {
  @PrimaryKey({ autoincrement: true })
  id!: number;

  @Property({ length: 200 })
  name: string;

  @Property({ length: 15 })
  host: string;

  @Property()
  port: number;

  @Property()
  rconPort: number;

  @Property({ length: 500 })
  rconPassword: string;

  @ManyToMany({ entity: () => Role, mappedBy: "whitelistedServers", eager: false })
  whitelistedRoles = new Collection<Role>(this);

  @ManyToMany({ entity: () => Role, mappedBy: "operatorServers", eager: false })
  operatorRoles = new Collection<Role>(this);

  constructor(name: string, host: string, port: number, rconPort: number, rconPassword: string,
              whitelistedRoles: Iterable<Role>, operatorRoles: Iterable<Role>) {
    this.name = name;
    this.host = host;
    this.port = port;
    this.rconPort = rconPort;
    this.rconPassword = rconPassword;
    this.whitelistedRoles.add(whitelistedRoles);
    this.operatorRoles.add(operatorRoles);
  }
}
