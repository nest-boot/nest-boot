import {
  EntityRepository,
  FilterQuery,
  FindOptions,
  Loaded,
  QueryOrder,
  QueryOrderMap,
} from "@mikro-orm/core";
import { InjectRepository } from "@mikro-orm/nestjs";
import { Injectable, Type } from "@nestjs/common";

import { IdEntity } from "../interfaces";

export type ChunkByIdOptions<T, P extends string = never> = Omit<
  FindOptions<T, P>,
  "offset" | "orderBy"
>;

export interface EntityService<T extends IdEntity<T>> {
  entityClass: Type<T>;

  repository: EntityRepository<T>;

  chunkById: <P extends string = never>(
    where: FilterQuery<T>,
    options: ChunkByIdOptions<T, P>,
    callback: (entities: T[]) => Promise<void>
  ) => Promise<this>;
}

export function createEntityService<T extends IdEntity<T> & { id: string }>(
  entityClass: Type<T>
): Type<EntityService<T>> {
  @Injectable()
  class AbstractEntityService implements EntityService<T> {
    @InjectRepository(entityClass)
    readonly repository!: EntityRepository<T>;

    readonly entityClass = entityClass;

    async chunkById<P extends string = never>(
      where: FilterQuery<T>,
      options: ChunkByIdOptions<T, P>,
      callback: (entities: T[]) => Promise<void>
    ): Promise<this> {
      let lastId: string | undefined;
      let count = 0;

      do {
        const entities: Array<Loaded<T, P>> = await this.repository.find(
          {
            $and: [
              where,
              ...(typeof lastId !== "undefined"
                ? [{ id: { $gt: lastId } }]
                : []),
            ],
          } as unknown as FilterQuery<T>,
          {
            ...options,
            orderBy: { id: QueryOrder.ASC } as unknown as QueryOrderMap<T>,
          }
        );

        count = entities.length;

        if (count > 0) {
          lastId = entities[count - 1].id;
        }

        // eslint-disable-next-line no-await-in-loop
        await callback(entities);
      } while ((typeof options?.limit !== "undefined" || 0) === count);

      return this;
    }
  }

  return AbstractEntityService;
}
