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

export interface EntityServiceOptions<Entity extends IdEntity> {
  softDeleteKey?: keyof Entity;
}

export class EntityService<Entity extends IdEntity> {
  constructor(
    protected readonly entityClass: Type<Entity>,
    protected readonly em: EntityManager,
    protected readonly options?: EntityServiceOptions<Entity>,
  ) {}

  get #getDataLoader() {
    return new DataLoader<FindOneArgs<Entity>, Entity | null>(
      async (items: readonly FindOneArgs<Entity>[]) => {
        const uow = this.em.getUnitOfWork();

        // 获取所有 ID
        const ids = items.map(({ idOrEntity }) =>
          typeof idOrEntity === "object" ? idOrEntity.id : idOrEntity,
        );

        // 先尝试从 UnitOfWork 中获取已加载的实体
        const entitiesFromUow: Loaded<Entity>[] = [];
        const idsToFetch: (string | number | bigint)[] = [];

        for (const id of ids) {
          // 尝试从 UnitOfWork 的身份映射中获取实体
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

        // 如果有需要从数据库查询的 ID,则执行查询
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

        // 合并 UnitOfWork 和数据库查询的结果
        const allEntities = [...entitiesFromUow, ...entitiesFromDb];

        // 按照原始顺序返回结果
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

          // 过滤掉 undefined 的值
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

  create(data: RequiredEntityData<Entity>): Promise<Entity> {
    return this.#createDataLoader.load(data);
  }

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

  async count<Hint extends string = never>(
    where: FilterQuery<NoInfer<Entity>>,
    options?: CountOptions<Entity, Hint>,
  ): Promise<number> {
    return await this.em.count<Entity, Hint>(this.entityClass, where, options);
  }

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
