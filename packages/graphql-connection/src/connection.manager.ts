import { EntityManager, type FilterQuery } from "@mikro-orm/core";
import type { FindOptions } from "@mikro-orm/core/drivers";
import { Injectable } from "@nestjs/common";

import { ConnectionQueryBuilder } from "./connection-query-builder";
import { ConnectionArgsInterface, ConnectionInterface } from "./interfaces";
import { ConnectionClass } from "./types";

export interface ConnectionFindOptions<
  Entity extends object,
  Hint extends string = never,
  Fields extends string = "*",
  Excludes extends string = never,
> extends Exclude<
    FindOptions<Entity, Hint, Fields, Excludes>,
    "limit" | "offset" | "orderBy"
  > {
  where?: FilterQuery<Entity>;
}

@Injectable()
export class ConnectionManager {
  constructor(private readonly em: EntityManager) {}

  async find<
    Entity extends object,
    Hint extends string = never,
    Fields extends string = "*",
    Excludes extends string = never,
  >(
    connectionClass: ConnectionClass<Entity>,
    args: ConnectionArgsInterface<Entity, Hint, Fields, Excludes>,
    options?: ConnectionFindOptions<Entity, Hint, Fields, Excludes>,
  ): Promise<ConnectionInterface<Entity>> {
    return await new ConnectionQueryBuilder(
      this.em,
      connectionClass,
      args,
      options,
    ).query();
  }
}
