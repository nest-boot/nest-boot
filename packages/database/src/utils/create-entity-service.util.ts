import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  DeepPartial,
  FindConditions,
  FindManyOptions,
  FindOneOptions,
  getMetadataArgsStorage,
  MoreThan,
  Repository,
} from "typeorm";

import { BaseEntity } from "../entities/base.entity";
import { TransactionalConnection } from "../services/transactional-connection";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface Type<T = any> extends Function {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  new (...args: any[]): T;
}

export interface ChunkByIdOptions<T = any>
  extends Omit<FindManyOptions<T>, "skip" | "take" | "order"> {
  where?: Exclude<FindManyOptions<T>["where"], string | FindConditions<T>[]>;
}

export interface EntityService<T extends BaseEntity> {
  target: Type<T>;
  connection: TransactionalConnection;
  repository: Repository<T>;

  create(input: DeepPartial<T>): Promise<T>;
  update(conditions: FindConditions<T>, input?: DeepPartial<T>): Promise<this>;
  delete(conditions: FindConditions<T>): Promise<this>;
  findAll(options?: FindManyOptions<T>): Promise<T[]>;
  findOneById(id: T["id"], options?: FindOneOptions<T>): Promise<T>;
  findOneByIdOrThrow(id: T["id"], options?: FindOneOptions<T>): Promise<T>;
  findOne(options: FindOneOptions<T>): Promise<T>;
  findOneOrThrow(options?: FindOneOptions<T>): Promise<T>;
  save(entity: DeepPartial<T> | T): Promise<T>;
  saveAll(entities: DeepPartial<T>[] | T[]): Promise<T[]>;
  load<P extends keyof T>(entity: T, propertyName: P & string): Promise<T[P]>;
  chunkById(
    options: ChunkByIdOptions<T>,
    count: number,
    callback: (entities: T[]) => Promise<void>
  ): Promise<this>;
}

export function createEntityService<T extends BaseEntity>(
  Entity: Type<T>
): Type<EntityService<T>> {
  @Injectable()
  class AbstractEntityService implements EntityService<T> {
    @Inject()
    readonly connection: TransactionalConnection;

    readonly target: Type<T> = Entity;

    async create(input: DeepPartial<T>): Promise<T> {
      const repository = this.connection.getRepository(this.target);
      return await this.save(repository.create(input));
    }

    async update(
      conditions: FindConditions<T>,
      input?: DeepPartial<T>
    ): Promise<this> {
      await this.repository.update(conditions, input);
      return this;
    }

    async delete(conditions: FindConditions<T>): Promise<this> {
      await this.repository.delete(conditions);
      return this;
    }

    get repository(): Repository<T> {
      return this.getRepository();
    }

    async findAll(options?: FindManyOptions<T>): Promise<T[]> {
      return await this.repository.find(options);
    }

    async findOneById(id: T["id"], options?: FindOneOptions<T>): Promise<T> {
      return await this.repository.findOne(id, options);
    }

    async findOneByIdOrThrow(
      id: T["id"],
      options?: FindOneOptions<T>
    ): Promise<T> {
      if (!id) {
        throw new NotFoundException(`${this.target.name} not found`);
      }

      const entity = await this.repository.findOne(id, options);

      if (!entity) {
        throw new NotFoundException(`${this.target.name} not found`);
      }

      return entity;
    }

    async findOne(options: FindOneOptions<T>): Promise<T> {
      return await this.repository.findOne(options);
    }

    async findOneOrThrow(options?: FindOneOptions<T>): Promise<T> {
      const entity = await this.repository.findOne(options);

      if (!entity) {
        throw new NotFoundException(`${this.target.name} not found`);
      }

      return entity;
    }

    async chunkById(
      options: ChunkByIdOptions<T>,
      size: number,
      callback: (entities: T[]) => Promise<void>
    ): Promise<this> {
      let lastId: string = null;
      let count = 0;

      do {
        // eslint-disable-next-line no-await-in-loop
        const entities = await this.repository.find({
          where: options.where
            ? options.where instanceof Array
              ? options.where.map((item) => ({}))
              : {
                  ...options.where,
                  ...(lastId ? { id: MoreThan(lastId) } : null),
                }
            : {
                ...options,
                ...(lastId ? { id: MoreThan(lastId) } : null),
              },
          take: size,
          order: { id: "ASC" },
        } as FindManyOptions<T>);

        count = entities.length;

        if (entities.length > 0) {
          lastId = entities[count - 1].id;
        }

        // eslint-disable-next-line no-await-in-loop
        await callback(entities);
      } while (size === count);

      // eslint-disable-next-line consistent-return
      return this;
    }

    getRepository(): Repository<T> {
      return this.connection.getRepository(this.target);
    }

    async save(entity: DeepPartial<T> | T): Promise<T> {
      return await this.repository.save(entity as DeepPartial<T>);
    }

    async saveAll(entities: DeepPartial<T>[] | T[]): Promise<T[]> {
      return await this.repository.save(entities as DeepPartial<T>[]);
    }

    async load<P extends keyof T>(
      entity: T,
      propertyName: P & string
    ): Promise<T[P]> {
      const relation = getMetadataArgsStorage().relations.find(
        (item) =>
          item.target === entity.constructor &&
          item.propertyName === propertyName
      );

      if (!relation) {
        throw new Error("Relation is not found.");
      }

      const queryBuilder = this.repository
        .createQueryBuilder()
        .relation(entity.constructor, propertyName)
        .of(entity);

      switch (relation.relationType) {
        case "one-to-many":
        case "many-to-many":
          // eslint-disable-next-line no-param-reassign
          entity[propertyName] = (await queryBuilder.loadMany()) as never;
          break;
        case "one-to-one":
        case "many-to-one":
          // eslint-disable-next-line no-param-reassign
          entity[propertyName] = await queryBuilder.loadOne();
          break;
        default:
      }

      return entity[propertyName];
    }
  }

  return AbstractEntityService;
}
