import {
  type AssignOptions,
  CountOptions,
  type EntityData,
  type EntityDTO,
  EntityManager,
  type ExpandQuery,
  FilterQuery,
  FindOptions,
  type FromEntityType,
  type IsSubset,
  type Loaded,
  type PopulatePath,
  QueryOrder,
  type QueryOrderMap,
  Utils,
} from "@mikro-orm/core";
import type { Primary, RequiredEntityData } from "@mikro-orm/core/typings";
import { NotFoundException, Type } from "@nestjs/common";
import DataLoader from "dataloader";
import _ from "lodash";

import type { IdEntity } from "../interfaces/id-entity.interface";
import type { ChunkByIdOptions } from "../types/chunk-by-id-options.type";
import type { IdOrEntity } from "../types/id-or-entity.type";

interface FindOneArgs<Entity extends IdEntity> {
  idOrEntity: IdOrEntity<Entity>;
}

interface UpdateArgs<
  Entity extends IdEntity,
  Naked extends FromEntityType<Entity> = FromEntityType<Entity>,
  Convert extends boolean = false,
  Data extends EntityData<Naked, Convert> | Partial<EntityDTO<Naked>> =
    | EntityData<Naked, Convert>
    | Partial<EntityDTO<Naked>>,
> {
  idOrEntity: IdOrEntity<Entity>;
  data: Data & IsSubset<EntityData<Naked, Convert>, Data>;
  options?: AssignOptions<Convert>;
}

interface RemoveArgs<Entity extends IdEntity> {
  idOrEntity: IdOrEntity<Entity>;
  softDelete: boolean;
}

/** Options for configuring an {@link EntityService} instance. */
export interface EntityServiceOptions<Entity extends IdEntity> {
  /** Entity property key used for soft-delete timestamps (defaults to `"deletedAt"`). */
  softDeleteKey?: keyof Entity;
}

/**
 * Generic CRUD service for MikroORM entities with DataLoader batching.
 *
 * @remarks
 * Provides batched `create`, `findOne`, `update`, and `remove` operations
 * via DataLoader for automatic N+1 prevention, plus standard `findAll`,
 * `count`, and `chunkById` methods.
 *
 * @typeParam Entity - The entity type, which must have an `id` property
 */
export class EntityService<Entity extends IdEntity> {
  /**
   * Creates a new EntityService instance.
   * @param entityClass - The entity class to manage
   * @param em - MikroORM entity manager
   * @param options - Optional service configuration (e.g. soft-delete key)
   */
  constructor(
    protected readonly entityClass: Type<Entity>,
    protected readonly em: EntityManager,
    protected readonly options?: EntityServiceOptions<Entity>,
  ) {}

  get #getDataLoader() {
    return new DataLoader<FindOneArgs<Entity>, Entity | null>(
      async (items: readonly FindOneArgs<Entity>[]) => {
        const uow = this.em.getUnitOfWork();

        // Get all IDs
        const ids = items.map(({ idOrEntity }) =>
          typeof idOrEntity === "object" ? idOrEntity.id : idOrEntity,
        );

        // First try to get already loaded entities from UnitOfWork
        const entitiesFromUow: Loaded<Entity>[] = [];
        const idsToFetch: (string | number | bigint)[] = [];

        for (const id of ids) {
          // Try to get entity from UnitOfWork's identity map
          const entity = uow.getById<Entity>(
            Utils.className(this.entityClass),
            id as Primary<Entity>,
          );

          if (entity) {
            entitiesFromUow.push(entity as Loaded<Entity>);
          } else {
            idsToFetch.push(id);
          }
        }

        // If there are IDs that need to be fetched from the database, execute the query
        let entitiesFromDb: Loaded<Entity>[] = [];
        if (idsToFetch.length > 0) {
          entitiesFromDb = await this.em.find(
            this.entityClass,
            {
              id: { $in: idsToFetch },
            },
            { limit: idsToFetch.length },
          );
        }

        // Merge results from UnitOfWork and database query
        const allEntities = [...entitiesFromUow, ...entitiesFromDb];

        // Return results in the original order
        return ids.map((id) => {
          return allEntities.find((entity) => entity.id === id) ?? null;
        });
      },
      { cache: false },
    );
  }

  get #createDataLoader() {
    return new DataLoader(
      async (data: readonly RequiredEntityData<Entity>[]) => {
        const entities = data.map((item) => {
          return this.em.create<Entity>(this.entityClass, item, {
            persist: true,
          });
        });

        await this.em.flush();

        return entities;
      },
      { cache: false },
    );
  }

  get #updateDataLoader() {
    return new DataLoader<UpdateArgs<Entity>, Entity | Error>(
      async (items) => {
        const entitiesOrErrors = (
          await Promise.all(
            items.map(({ idOrEntity }) => this.findOne(idOrEntity)),
          )
        ).map((entity) => {
          if (entity === null) {
            return new NotFoundException(
              `${this.entityClass.name.toLowerCase()}.not_found`,
            );
          }

          return entity;
        });

        entitiesOrErrors.forEach((entityOrError, index) => {
          if (entityOrError instanceof Error) {
            return entityOrError;
          }

          const { data, options } = items[index];

          // Filter out undefined values
          const filteredData = Object.fromEntries(
            Object.entries(data).filter(([, value]) => value !== undefined),
          ) as typeof data;

          this.em.assign(entityOrError, filteredData, options);
        });

        await this.em.flush();

        return entitiesOrErrors;
      },
      { cache: false },
    );
  }

  get #removeDataLoader() {
    return new DataLoader<RemoveArgs<Entity>, Entity | Error>(
      async (items) => {
        const entitiesOrErrors = (
          await Promise.all(
            items.map(({ idOrEntity }) => this.findOne(idOrEntity)),
          )
        ).map((entity) => {
          if (entity === null) {
            return new NotFoundException(
              `${this.entityClass.name.toLowerCase()}.not_found`,
            );
          }

          return entity;
        });

        entitiesOrErrors.forEach((entityOrError, index) => {
          if (entityOrError instanceof Error) {
            return entityOrError;
          }

          const { softDelete } = items[index];
          const softDeleteKey = this.options?.softDeleteKey ?? "deletedAt";

          if (softDelete && softDeleteKey in entityOrError) {
            (entityOrError as any)[softDeleteKey] = new Date();
          } else {
            this.em.remove(entityOrError);
          }
        });

        await this.em.flush();

        return entitiesOrErrors;
      },
      { cache: false },
    );
  }

  /**
   * Creates a new entity and persists it.
   * @param data - The entity data to create
   * @returns The created entity
   */
  create(data: RequiredEntityData<Entity>): Promise<Entity> {
    return this.#createDataLoader.load(data);
  }

  /**
   * Finds a single entity by ID, entity reference, or filter query.
   * @param idOrEntityOrWhere - The entity ID, entity instance, or filter query
   * @returns The found entity or null
   */
  async findOne(
    idOrEntityOrWhere: IdOrEntity<Entity> | FilterQuery<NoInfer<Entity>>,
  ): Promise<Loaded<Entity> | null> {
    if (_.isPlainObject(idOrEntityOrWhere)) {
      return await this.em.findOne<Entity>(
        this.entityClass,
        idOrEntityOrWhere as FilterQuery<NoInfer<Entity>>,
      );
    } else {
      return (await this.#getDataLoader.load({
        idOrEntity: idOrEntityOrWhere as IdOrEntity<Entity>,
      })) as Loaded<Entity> | null;
    }
  }

  /**
   * Finds a single entity by ID, entity reference, or filter query, throwing if not found.
   * @param idOrEntityOrWhere - The entity ID, entity instance, or filter query
   * @returns The found entity
   * @throws NotFoundException if the entity is not found
   */
  async findOneOrFail(
    idOrEntityOrWhere: IdOrEntity<Entity> | FilterQuery<Entity>,
  ): Promise<Loaded<Entity>> {
    const entity = await this.findOne(idOrEntityOrWhere);

    if (entity === null) {
      throw new NotFoundException(
        `${_.capitalize(this.entityClass.name)} not found`,
      );
    }

    return entity;
  }

  /**
   * Finds all entities matching the given filter query.
   * @param where - Filter query
   * @param options - Find options (populate, limit, offset, etc.)
   * @returns Array of matching entities
   */
  async findAll<
    Hint extends string = never,
    Fields extends string = PopulatePath.ALL,
    Excludes extends string = never,
  >(
    where: FilterQuery<NoInfer<Entity>>,
    options?: FindOptions<Entity, Hint, Fields, Excludes>,
  ): Promise<Loaded<Entity, Hint, Fields, Excludes>[]> {
    return await this.em.find<Entity, Hint, Fields, Excludes>(
      this.entityClass,
      where,
      options,
    );
  }

  /**
   * Counts entities matching the given filter query.
   * @param where - Filter query
   * @param options - Count options
   * @returns The number of matching entities
   */
  async count<Hint extends string = never>(
    where: FilterQuery<NoInfer<Entity>>,
    options?: CountOptions<Entity, Hint>,
  ): Promise<number> {
    return await this.em.count<Entity, Hint>(this.entityClass, where, options);
  }

  /**
   * Updates an entity by ID or reference.
   * @param idOrEntity - The entity ID or entity instance to update
   * @param data - The data to assign to the entity
   * @param options - Optional assign options
   * @returns The updated entity
   * @throws NotFoundException if the entity is not found
   */
  async update<
    Naked extends FromEntityType<Entity> = FromEntityType<Entity>,
    Convert extends boolean = false,
    Data extends EntityData<Naked, Convert> | Partial<EntityDTO<Naked>> =
      | EntityData<Naked, Convert>
      | Partial<EntityDTO<Naked>>,
  >(
    idOrEntity: IdOrEntity<Entity>,
    data: Data & IsSubset<EntityData<Naked, Convert>, Data>,
    options?: AssignOptions<Convert>,
  ): Promise<Entity> {
    const entity = await this.#updateDataLoader.load({
      idOrEntity,
      data,
      options,
    } as UpdateArgs<Entity, Naked, Convert, Data> as any);

    if (entity instanceof Error) {
      throw entity;
    }

    return entity;
  }

  /**
   * Removes an entity by ID or reference (supports soft-delete).
   * @param idOrEntity - The entity ID or entity instance to remove
   * @param softDelete - Whether to soft-delete (default: true)
   * @returns The removed entity
   * @throws NotFoundException if the entity is not found
   */
  async remove(
    idOrEntity: IdOrEntity<Entity>,
    softDelete = true,
  ): Promise<Entity> {
    const entity = await this.#removeDataLoader.load({
      idOrEntity,
      softDelete,
    });

    if (entity instanceof Error) {
      throw entity;
    }

    return entity;
  }

  /**
   * Iterates over entities in chunks ordered by ID, useful for batch processing.
   * @param where - Filter query
   * @param options - Find options (limit determines chunk size)
   * @param callback - Async callback invoked with each chunk of entities
   * @returns This service instance for chaining
   */
  async chunkById<
    Hint extends string = never,
    Fields extends string = PopulatePath.ALL,
    Excludes extends string = never,
  >(
    where: ExpandQuery<Entity>,
    options: ChunkByIdOptions<Entity, Hint, Fields, Excludes>,
    callback: (
      entities: Loaded<Entity, Hint, Fields, Excludes>[],
    ) => Promise<void>,
  ): Promise<this> {
    let lastId: number | string | bigint | undefined;
    let count = 0;

    do {
      const entities = await this.em.find<Entity, Hint, Fields, Excludes>(
        this.entityClass,
        {
          $and: [
            where,
            ...(typeof lastId !== "undefined" ? [{ id: { $gt: lastId } }] : []),
          ],
        } as unknown as FilterQuery<Entity>,
        {
          ...options,
          orderBy: { id: QueryOrder.ASC } as unknown as QueryOrderMap<Entity>,
        },
      );

      count = entities.length;

      if (count > 0) {
        lastId = (entities[count - 1] as Entity)?.id;
      } else {
        break;
      }

      await callback(entities);
    } while (count === (options.limit ?? 0));

    return this;
  }
}
