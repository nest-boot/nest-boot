/* eslint-disable no-nested-ternary */
import { AnyEntity, FilterQuery } from "@nest-boot/database";
import { SearchableEntityRepository } from "@nest-boot/search";
import { Injectable } from "@nestjs/common";

import { QueryConnectionArgs } from "../dtos/query-connection.args";
import { Connection } from "../interfaces/connection.interface";
import { Type } from "../interfaces/type.interface";
import { getConnection } from "./get-connection";

export interface ConnectionEntityService<T extends AnyEntity>
  extends SearchableEntityRepository<T> {
  getConnection(
    args: QueryConnectionArgs,
    where?: FilterQuery<T>
  ): Promise<Connection<T>>;
}

export function mixinConnection<T extends AnyEntity>(
  Base: Type<SearchableEntityRepository<T>>
): Type<ConnectionEntityService<T>> {
  @Injectable()
  class ConnectionTrait extends Base implements ConnectionEntityService<T> {
    async getConnection(
      args: QueryConnectionArgs,
      where: FilterQuery<T>
    ): Promise<Connection<T>> {
      return null;
    }
  }

  return ConnectionTrait;
}
