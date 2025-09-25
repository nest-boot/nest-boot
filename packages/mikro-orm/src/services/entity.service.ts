import {
  type AssignOptions,
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
} from "@mikro-orm/core";
import type { RequiredEntityData } from "@mikro-orm/core/typings";
import { NotFoundException, Type } from "@nestjs/common";
import DataLoader from "dataloader";
import _ from "lodash";

export interface IdEntity {
  id: number | string | bigint;
}

export type IdOrEntity<Entity extends IdEntity> = IdEntity["id"] | Entity;

export type ChunkByIdOptions<
  Entity,
  Hint extends string = never,
  Fields extends string = PopulatePath.ALL,
  Excludes extends string = never,
> = Omit<FindOptions<Entity, Hint, Fields, Excludes>, "offset" | "orderBy">;

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

export class EntityService<Entity extends IdEntity> {
  constructor(
    protected readonly entityClass: Type<Entity>,
    protected readonly em: EntityManager,
  ) {}

  get #getDataLoader() {
    return new DataLoader<IdOrEntity<Entity>, Entity | null>(
      async (idsOrEntities) => {
        const ids = idsOrEntities.filter(
          (idOrEntity) => typeof idOrEntity !== "object",
        );

        const entities = await this.em.find(
          this.entityClass,
          {
            id: { $in: ids },
          },
          { limit: ids.length },
        );

        return idsOrEntities.map((idOrEntity) => {
          if (typeof idOrEntity === "object") {
            return idOrEntity;
          }

          return entities.find((entity) => entity.id === idOrEntity) ?? null;
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
    return new DataLoader<IdOrEntity<Entity>, Entity | Error>(
      async (idsOrEntities: readonly (string | number | bigint | Entity)[]) => {
        const entitiesOrErrors = (
          await Promise.all(
            idsOrEntities.map((idOrEntity) => this.findOne(idOrEntity)),
          )
        ).map((entity) => {
          if (entity === null) {
            return new NotFoundException(
              `${this.entityClass.name.toLowerCase()}.not_found`,
            );
          }

          this.em.remove(entity);

          return entity;
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
    idOrEntityOrWhere: IdOrEntity<Entity> | FilterQuery<Entity>,
  ): Promise<Entity | null> {
    if (_.isPlainObject(idOrEntityOrWhere)) {
      return await this.em.findOne(this.entityClass, idOrEntityOrWhere);
    } else {
      return await this.#getDataLoader.load(
        idOrEntityOrWhere as IdOrEntity<Entity>,
      );
    }
  }

  async findOneOrFail(
    idOrEntityOrWhere: IdOrEntity<Entity> | FilterQuery<Entity>,
  ): Promise<Entity> {
    const entity = await this.findOne(idOrEntityOrWhere);

    if (entity === null) {
      throw new NotFoundException(
        `${_.capitalize(this.entityClass.name)} not found`,
      );
    }

    return entity;
  }

  async findAll(
    where: FilterQuery<Entity>,
    options?: FindOptions<Entity>,
  ): Promise<Entity[]> {
    return await this.em.find(this.entityClass, where, options);
  }

  async count(
    where: FilterQuery<Entity>,
    options?: FindOptions<Entity>,
  ): Promise<number> {
    return await this.em.count(this.entityClass, where, options);
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

  async remove(idOrEntity: IdOrEntity<Entity>): Promise<Entity> {
    const entity = await this.#removeDataLoader.load(idOrEntity);

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
