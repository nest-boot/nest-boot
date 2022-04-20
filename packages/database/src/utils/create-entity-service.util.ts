/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable, Type } from "@nestjs/common";
import {
  AnyEntity,
  EntityRepository,
  FilterQuery,
  FindOptions,
  QueryOrderMap,
  QueryOrder,
} from "@mikro-orm/core";
import { InjectRepository } from "@mikro-orm/nestjs";

export interface ChunkByIdOptions<T, P extends string = never>
  extends Omit<FindOptions<T, P>, "offset" | "orderBy"> {}

export interface EntityService<T extends AnyEntity<T>> {
  entityClass: Type<T>;

  repository: EntityRepository<T>;

  chunkById<P extends string = never>(
    where: FilterQuery<T>,
    options: ChunkByIdOptions<T, P>,
    callback: (entities: T[]) => Promise<void>
  ): Promise<this>;
}

export function createEntityService<T extends AnyEntity<T> & { id: string }>(
  entityClass: Type<T>
): Type<EntityService<T>> {
  @Injectable()
  class AbstractEntityService implements EntityService<T> {
    readonly entityClass = entityClass;

    @InjectRepository(entityClass)
    readonly repository: EntityRepository<T>;

    async chunkById<P extends string = never>(
      where: FilterQuery<T>,
      options: ChunkByIdOptions<T, P>,
      callback: (entities: T[]) => Promise<void>
    ): Promise<this> {
      let lastId: string = null;
      let count = 0;

      do {
        const entities = await this.repository.find(
          {
            $and: [where, { id: { $gt: lastId } }],
          } as FilterQuery<T>,
          { ...options, orderBy: { id: QueryOrder.ASC } as QueryOrderMap<T> }
        );

        count = entities.length;

        if (entities.length > 0) {
          lastId = entities[count - 1].id;
        }

        await callback(entities);
      } while ((options?.limit || 0) === count);

      // eslint-disable-next-line consistent-return
      return this;
    }
  }

  return AbstractEntityService;
}
