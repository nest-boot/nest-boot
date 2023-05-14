import { type FilterQuery } from "@mikro-orm/core";
import { type SearchableEntityService } from "@nest-boot/search";
import { Injectable, type Type } from "@nestjs/common";

import {
  type ConnectionArgsInterface,
  type ConnectionInterface,
} from "../interfaces";
import { getConnection } from "./get-connection";

export interface ConnectionEntityService<
  T extends { id: number | string | bigint }
> extends SearchableEntityService<T> {
  getConnection: (
    args: ConnectionArgsInterface<T>,
    where?: FilterQuery<T>
  ) => Promise<ConnectionInterface<T>>;
}

export function mixinConnection<T extends { id: number | string | bigint }>(
  Base: Type<SearchableEntityService<T>>
): Type<ConnectionEntityService<T>> {
  @Injectable()
  class ConnectionTrait extends Base implements ConnectionEntityService<T> {
    async getConnection(
      args: ConnectionArgsInterface<T>,
      where?: FilterQuery<T>
    ): Promise<ConnectionInterface<T>> {
      return await getConnection(this, args, where);
    }
  }

  return ConnectionTrait;
}
