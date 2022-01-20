/* eslint-disable no-nested-ternary */
import { BaseEntity, FindConditions } from "@nest-boot/database";
import { SearchableEntityService } from "@nest-boot/search";
import { Injectable } from "@nestjs/common";

import { QueryConnectionArgs } from "../dtos/query-connection.args";
import { Connection } from "../interfaces/connection.interface";
import { Type } from "../interfaces/type.interface";
import { getConnection } from "./get-connection";

export interface ConnectionEntityService<T extends BaseEntity>
  extends SearchableEntityService<T> {
  getConnection(
    args: QueryConnectionArgs,
    where?: FindConditions<T>
  ): Promise<Connection<T>>;
}

export function mixinConnection<T extends BaseEntity>(
  Base: Type<SearchableEntityService<T>>
): Type<ConnectionEntityService<T>> {
  @Injectable()
  class ConnectionTrait extends Base implements ConnectionEntityService<T> {
    async getConnection(
      args: QueryConnectionArgs,
      where: FindConditions<T> = {}
    ): Promise<Connection<T>> {
      return await getConnection(this, args, where);
    }
  }

  return ConnectionTrait;
}
