import { type EntityManager, type FilterQuery } from "@mikro-orm/core";
import { type SearchableEntityService } from "@nest-boot/search";
import { Injectable, type Type } from "@nestjs/common";

import {
  type ConnectionArgsInterface,
  type ConnectionInterface,
} from "../interfaces";
import { getConnection } from "./get-connection";

export interface ConnectionEntityService<
  E extends { id: number | string | bigint },
  EM extends EntityManager
> extends SearchableEntityService<E, EM> {
  getConnection: (
    args: ConnectionArgsInterface<E>,
    where?: FilterQuery<E>
  ) => Promise<ConnectionInterface<E>>;
}

export function mixinConnection<
  E extends { id: number | string | bigint },
  EM extends EntityManager
>(
  Base: Type<SearchableEntityService<E, EM>>
): Type<ConnectionEntityService<E, EM>> {
  @Injectable()
  class ConnectionTrait extends Base implements ConnectionEntityService<E, EM> {
    async getConnection(
      args: ConnectionArgsInterface<E>,
      where?: FilterQuery<E>
    ): Promise<ConnectionInterface<E>> {
      return await getConnection(this, args, where);
    }
  }

  return ConnectionTrait;
}
