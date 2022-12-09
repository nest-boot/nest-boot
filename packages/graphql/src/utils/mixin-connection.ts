/* eslint-disable no-nested-ternary */
import { FilterQuery } from "@mikro-orm/core";
import { IdEntity } from "@nest-boot/database";
import { SearchableEntityService } from "@nest-boot/search";
import { Injectable, Type } from "@nestjs/common";

import { ConnectionArgsInterface, ConnectionInterface } from "../interfaces";
import { getConnection } from "./get-connection";

export interface ConnectionEntityService<T extends IdEntity, P extends keyof T>
  extends SearchableEntityService<T> {
  getConnection: (
    args: ConnectionArgsInterface<T, P>,
    where?: FilterQuery<T>
  ) => Promise<ConnectionInterface<T>>;
}

export function mixinConnection<T extends IdEntity, P extends keyof T>(
  Base: Type<SearchableEntityService<T>>
): Type<ConnectionEntityService<T, P>> {
  @Injectable()
  class ConnectionTrait extends Base implements ConnectionEntityService<T, P> {
    async getConnection(
      args: ConnectionArgsInterface<T, P>,
      where?: FilterQuery<T>
    ): Promise<ConnectionInterface<T>> {
      return await getConnection(this, args, where);
    }
  }

  return ConnectionTrait;
}
