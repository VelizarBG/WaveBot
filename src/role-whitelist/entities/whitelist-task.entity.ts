import { Entity, Enum, ManyToOne, PrimaryKey, Property } from "@mikro-orm/sqlite";
import { Operation } from "../handlers/operation";
import { MinecraftServer } from "./minecraft-server.entity";

export { Operation } from "../handlers/operation";

@Entity({ tableName: "whitelist_tasks" })
export class WhitelistTask {
  @PrimaryKey({ autoincrement: true })
  id!: number;

  @Property({ length: 16 })
  ign: string;

  @Enum(() => Operation)
  operation: Operation;

  @ManyToOne()
  server: MinecraftServer;

  @Property()
  attempts = 0;

  constructor(ign: string, operation: Operation, server: MinecraftServer) {
    this.ign = ign;
    this.operation = operation;
    this.server = server;
  }
}
