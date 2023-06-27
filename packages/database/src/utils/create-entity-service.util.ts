import {
  type EntityManager,
  type EntityRepository,
  type FilterQuery,
  type FindOptions,
  type Loaded,
  QueryOrder,
  type QueryOrderMap,
} from "@mikro-orm/core";
import { Inject, Injectable, type Type } from "@nestjs/common";

export type ChunkByIdOptions<T, P extends string = never> = Omit<
  FindOptions<T, P>,
  "offset" | "orderBy"
>;

export interface EntityService<
  E extends { id: number | string | bigint },
  EM extends EntityManager
> {
  readonly entityClass: Type<E>;

  readonly entityManager: EM;

  readonly repository: EntityRepository<E>;

  chunkById: <P extends string = never>(
    where: FilterQuery<E>,
    options: ChunkByIdOptions<E, P>,
    callback: (entities: E[]) => Promise<void>
  ) => Promise<this>;
}

export function createEntityService<
  E extends { id: number | string | bigint },
  EM extends EntityManager
>(
  entityClass: Type<E>,
  entityEntityClass: Type<EM>
): Type<EntityService<E, EM>> {
  @Injectable()
  class AbstractEntityService implements EntityService<E, EM> {
    readonly entityClass = entityClass;

    @Inject(entityEntityClass)
    readonly entityManager!: EM;

    get em(): EM {
      return this.entityManager;
    }

    get repository(): EntityRepository<E> {
      return this.entityManager.getRepository(this.entityClass);
    }

    async chunkById<P extends string = never>(
      where: FilterQuery<E>,
      options: ChunkByIdOptions<E, P>,
      callback: (entities: E[]) => Promise<void>
    ): Promise<this> {
      let lastId: number | string | bigint | undefined;
      let count = 0;

      do {
        const entities: Array<Loaded<E, P>> = await this.entityManager
          .getRepository(this.entityClass)
          .find(
            {
              $and: [
                where,
                ...(typeof lastId !== "undefined"
                  ? [{ id: { $gt: lastId } }]
                  : []),
              ],
            } as unknown as FilterQuery<E>,
            {
              ...options,
              orderBy: { id: QueryOrder.ASC } as unknown as QueryOrderMap<E>,
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
