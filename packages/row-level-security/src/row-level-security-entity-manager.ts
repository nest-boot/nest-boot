import {
  CountOptions,
  Cursor,
  DeleteOptions,
  EntityData,
  EntityManager,
  EntityName,
  FilterQuery,
  FindAllOptions,
  FindByCursorOptions,
  FindOneOptions,
  FindOneOrFailOptions,
  FindOptions,
  Knex,
  Loaded,
  NativeInsertUpdateOptions,
  NoInfer,
  PopulatePath,
  Primary,
  RequiredEntityData,
  TransactionOptions,
  UpdateOptions,
  UpsertManyOptions,
  UpsertOptions,
} from "@mikro-orm/postgresql";

import { RowLevelSecurityContext } from "./row-level-security-context";
import { assertSnakeCase } from "./utils/assert-snake-case";
import { getRowLevelSecurityOptions } from "./utils/get-row-level-security-options";
import { RowLevelSecurityContextBuilder } from "./utils/row-level-security-context-builder";
import { RowLevelSecurityContextValue } from "./utils/row-level-security-context-builder.types";

/**
 * MikroORM entity manager that wraps database operations in transactions with
 * transaction-local PostgreSQL role and context settings.
 */
export class RowLevelSecurityEntityManager extends EntityManager {
  async transactional<T>(
    cb: (em: this) => T | Promise<T>,
    options?: TransactionOptions,
  ): Promise<T> {
    const rowLevelSecurityOptions = getRowLevelSecurityOptions();

    if (
      rowLevelSecurityOptions.shouldApply &&
      !(await rowLevelSecurityOptions.shouldApply())
    ) {
      return await super.transactional(cb, options);
    }

    return await super.transactional(async (em) => {
      const knex = em.getTransactionContext<Knex>();

      if (!knex) {
        throw new Error(
          "Transaction context is not available. Ensure you are calling this method within a transaction.",
        );
      }

      const builder = new RowLevelSecurityContextBuilder(
        rowLevelSecurityOptions.namespace,
      );
      const role =
        RowLevelSecurityContext.getRole() ??
        ((await rowLevelSecurityOptions.isAuthenticated?.())
          ? (rowLevelSecurityOptions.authenticatedRole ?? "authenticated")
          : (rowLevelSecurityOptions.anonymousRole ?? "anonymous"));
      const context = await rowLevelSecurityOptions.getContext?.();

      appendContext(builder, context);
      appendContext(builder, RowLevelSecurityContext.entries());

      assertSnakeCase(role, "Row level security database role");
      await knex.raw(
        [
          /* SQL */ `SET LOCAL ROLE ${role};`,
          builder.entries().length > 0 ? builder.toSQL() : "",
        ]
          .filter(Boolean)
          .join("\n"),
      );

      return await cb(em);
    }, options);
  }

  find<
    Entity extends object,
    Hint extends string = never,
    Fields extends string = PopulatePath.ALL,
    Excludes extends string = never,
  >(
    entityName: EntityName<Entity>,
    where: FilterQuery<NoInfer<Entity>>,
    options?: FindOptions<Entity, Hint, Fields, Excludes>,
  ): Promise<Loaded<Entity, Hint, Fields, Excludes>[]> {
    if (this.isInTransaction()) {
      return super.find(entityName, where, options);
    }

    return this.transactional((em) => em.find(entityName, where, options));
  }

  findAll<
    Entity extends object,
    Hint extends string = never,
    Fields extends string = "*",
    Excludes extends string = never,
  >(
    entityName: EntityName<Entity>,
    options?: FindAllOptions<NoInfer<Entity>, Hint, Fields, Excludes>,
  ): Promise<Loaded<Entity, Hint, Fields, Excludes>[]> {
    if (this.isInTransaction()) {
      return super.findAll(entityName, options);
    }

    return this.transactional((em) => em.findAll(entityName, options));
  }

  findOne<
    Entity extends object,
    Hint extends string = never,
    Fields extends string = "*",
    Excludes extends string = never,
  >(
    entityName: EntityName<Entity>,
    where: FilterQuery<NoInfer<Entity>>,
    options?: FindOneOptions<Entity, Hint, Fields, Excludes>,
  ): Promise<Loaded<Entity, Hint, Fields, Excludes> | null> {
    if (this.isInTransaction()) {
      return super.findOne(entityName, where, options);
    }

    return this.transactional((em) => em.findOne(entityName, where, options));
  }

  findOneOrFail<
    Entity extends object,
    Hint extends string = never,
    Fields extends string = "*",
    Excludes extends string = never,
  >(
    entityName: EntityName<Entity>,
    where: FilterQuery<NoInfer<Entity>>,
    options?: FindOneOrFailOptions<Entity, Hint, Fields, Excludes>,
  ): Promise<Loaded<Entity, Hint, Fields, Excludes>> {
    if (this.isInTransaction()) {
      return super.findOneOrFail(entityName, where, options);
    }

    return this.transactional((em) =>
      em.findOneOrFail(entityName, where, options),
    );
  }

  findAndCount<
    Entity extends object,
    Hint extends string = never,
    Fields extends string = PopulatePath.ALL,
    Excludes extends string = never,
  >(
    entityName: EntityName<Entity>,
    where: FilterQuery<NoInfer<Entity>>,
    options?: FindOptions<Entity, Hint, Fields, Excludes>,
  ): Promise<[Loaded<Entity, Hint, Fields, Excludes>[], number]> {
    if (this.isInTransaction()) {
      return super.findAndCount(entityName, where, options);
    }

    return this.transactional((em) =>
      em.findAndCount(entityName, where, options),
    );
  }

  findByCursor<
    Entity extends object,
    Hint extends string = never,
    Fields extends string = "*",
    Excludes extends string = never,
    IncludeCount extends boolean = true,
  >(
    entityName: EntityName<Entity>,
    where: FilterQuery<NoInfer<Entity>>,
    options: FindByCursorOptions<Entity, Hint, Fields, Excludes, IncludeCount>,
  ): Promise<Cursor<Entity, Hint, Fields, Excludes, IncludeCount>> {
    if (this.isInTransaction()) {
      return super.findByCursor(entityName, where, options);
    }

    return this.transactional((em) =>
      em.findByCursor(entityName, where, options),
    );
  }

  count<Entity extends object, Hint extends string = never>(
    entityName: EntityName<Entity>,
    where?: FilterQuery<NoInfer<Entity>>,
    options?: CountOptions<Entity, Hint>,
  ): Promise<number> {
    if (this.isInTransaction()) {
      return super.count(entityName, where, options);
    }

    return this.transactional((em) => em.count(entityName, where, options));
  }

  insert<Entity extends object>(
    entityNameOrEntity: EntityName<Entity> | Entity,
    data?: RequiredEntityData<Entity> | Entity,
    options?: NativeInsertUpdateOptions<Entity>,
  ): Promise<Primary<Entity>> {
    if (this.isInTransaction()) {
      return super.insert(entityNameOrEntity, data, options);
    }

    return this.transactional((em) =>
      em.insert(entityNameOrEntity, data, options),
    );
  }

  // @ts-expect-error - MikroORM type duplication/deep mapped type collision
  insertMany<Entity extends object>(
    entityNameOrEntities: EntityName<Entity> | Entity[],
    data?: RequiredEntityData<Entity>[] | Entity[],
    options?: NativeInsertUpdateOptions<Entity>,
  ): Promise<Primary<Entity>[]> {
    if (this.isInTransaction()) {
      return super.insertMany(
        entityNameOrEntities as any,
        data as any,
        options,
      ) as any;
    }

    return this.transactional(
      (em) =>
        em.insertMany(entityNameOrEntities as any, data as any, options) as any,
    );
  }

  nativeUpdate<Entity extends object>(
    entityName: EntityName<Entity>,
    where: FilterQuery<NoInfer<Entity>>,
    data: EntityData<Entity>,
    options?: UpdateOptions<Entity>,
  ): Promise<number> {
    if (this.isInTransaction()) {
      return super.nativeUpdate(entityName, where, data, options);
    }

    return this.transactional((em) =>
      em.nativeUpdate(entityName, where, data, options),
    );
  }

  nativeDelete<Entity extends object>(
    entityName: EntityName<Entity>,
    where: FilterQuery<NoInfer<Entity>>,
    options?: DeleteOptions<Entity>,
  ): Promise<number> {
    if (this.isInTransaction()) {
      return super.nativeDelete(entityName, where, options);
    }

    return this.transactional((em) =>
      em.nativeDelete(entityName, where, options),
    );
  }

  upsert<Entity extends object, Fields extends string = any>(
    entityNameOrEntity: EntityName<Entity> | Entity,
    data?: EntityData<Entity> | NoInfer<Entity>,
    options?: UpsertOptions<Entity, Fields>,
  ): Promise<Entity> {
    if (this.isInTransaction()) {
      return super.upsert(entityNameOrEntity, data, options);
    }

    return this.transactional((em) =>
      em.upsert(entityNameOrEntity, data, options),
    );
  }

  upsertMany<Entity extends object, Fields extends string = any>(
    entityNameOrEntity: EntityName<Entity> | Entity[],
    data?: (EntityData<Entity> | NoInfer<Entity>)[],
    options?: UpsertManyOptions<Entity, Fields>,
  ): Promise<Entity[]> {
    if (this.isInTransaction()) {
      return super.upsertMany(entityNameOrEntity, data, options);
    }

    return this.transactional((em) =>
      em.upsertMany(entityNameOrEntity, data, options),
    );
  }

  flush(): Promise<void> {
    if (this.isInTransaction()) {
      return super.flush();
    }

    return this.transactional((em) => em.flush());
  }
}

function appendContext(
  builder: RowLevelSecurityContextBuilder,
  context:
    | Iterable<readonly [string, RowLevelSecurityContextValue]>
    | undefined,
) {
  for (const [key, value] of context ?? []) {
    builder.set(key, value);
  }
}
