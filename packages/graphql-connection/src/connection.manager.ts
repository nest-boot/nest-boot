import {
  EntityManager,
  type EntityMetadata,
  type FilterQuery,
  type FindOptions,
  type ObjectQuery,
  QueryFlag,
  type Transaction,
} from "@mikro-orm/core";
import type { QueryBuilder, SqlEntityManager } from "@mikro-orm/sql";
import { Inject, Injectable } from "@nestjs/common";

import { ConnectionQueryBuilder } from "./connection-query-builder.js";
import { CountPrecision } from "./enums/count-precision.enum.js";
import {
  ConnectionArgsInterface,
  ConnectionResult,
  CountArgsInterface,
} from "./interfaces/index.js";
import type { Count } from "./objects/count.object.js";
import { ConnectionClass } from "./types/index.js";
import {
  getConnectionMetadata,
  getConnectionWhere,
} from "./utils/connection-filters.js";

/**
 * Options for the ConnectionManager.find method.
 *
 * Extends MikroORM FindOptions but excludes pagination-related options
 * (limit, offset, orderBy) which are handled by the connection arguments.
 * @template Entity - The entity type being queried
 * @template Hint - Type hints for population
 * @template Fields - Fields to select
 * @template Excludes - Fields to exclude
 */
export interface ConnectionFindOptions<
  Entity extends object,
  Hint extends string = never,
  Fields extends string = "*",
  Excludes extends string = never,
> extends Omit<
  FindOptions<Entity, Hint, Fields, Excludes>,
  "limit" | "offset" | "orderBy"
> {
  /**
   * Additional filter query to apply to the connection query.
   * This is merged with any filters from the connection arguments.
   */
  where?: FilterQuery<Entity>;
}

/** Scope options used to count matching entities. */
export type ConnectionCountOptions<Entity extends object> = Pick<
  ConnectionFindOptions<Entity>,
  "where" | "schema" | "filters"
> & {
  /** An optional per-entity assertion applied before returning a count. */
  assertMatch?: (entity: Entity) => void;
};

const COUNT_LIMIT = 10_000;

interface SqlReadPlanner<Entity extends object> {
  createQueryBuilderFromOptions(
    entity: EntityMetadata<Entity>,
    where: FilterQuery<Entity>,
    options: FindOptions<Entity> & {
      _populateWhere: FindOptions<Entity>["populateWhere"];
    },
  ): Promise<QueryBuilder<Entity>>;
}

/**
 * Service for executing paginated GraphQL connection queries.
 *
 * The ConnectionManager provides a high-level API for querying entities
 * with cursor-based pagination following the Relay connection specification.
 * @example Basic usage in a resolver
 * ```typescript
 * @Resolver(() => User)
 * export class UserResolver {
 *   constructor(private readonly connectionManager: ConnectionManager) {}
 *
 *   @Query(() => UserConnection)
 *   async users(
 *     @Args() args: UserConnectionArgs,
 *   ): Promise<ConnectionResult<User>> {
 *     return this.connectionManager.find(UserConnection, args);
 *   }
 * }
 * ```
 * @example With additional filters
 * ```typescript
 * @Query(() => UserConnection)
 * async activeUsers(@Args() args: UserConnectionArgs): Promise<UserConnection> {
 *   return this.connectionManager.find(UserConnection, args, {
 *     where: { isActive: true },
 *   });
 * }
 * ```
 */
@Injectable()
export class ConnectionManager {
  /**
   * Creates a new ConnectionManager instance.
   * Uses the core DI token because SQL drivers register their concrete manager, not its SQL base class.
   * @param em - MikroORM SQL entity manager for querying entities
   */
  constructor(@Inject(EntityManager) private readonly em: SqlEntityManager) {}

  /**
   * Loads one page of the connection.
   * @template Entity - The entity type.
   * @template Hint - Relations to populate.
   * @template Fields - Fields to select.
   * @template Excludes - Fields to exclude.
   * @param connectionClass - The generated connection.
   * @param args - Pagination, search, filter, and order arguments.
   * @param options - Additional database scope and find options.
   * @returns The page and its cursor information.
   */
  async find<
    Entity extends object,
    Hint extends string = never,
    Fields extends string = "*",
    Excludes extends string = never,
  >(
    connectionClass: ConnectionClass<Entity>,
    args: ConnectionArgsInterface<Entity>,
    options?: ConnectionFindOptions<Entity, Hint, Fields, Excludes>,
  ): Promise<ConnectionResult<Entity>> {
    return await new ConnectionQueryBuilder(
      this.em,
      connectionClass,
      args,
      options,
    ).query();
  }

  /**
   * Counts matches within the same search, filter, and server scope as a page.
   * @template Entity - The entity type.
   * @param connectionClass - The generated connection.
   * @param args - Search and filter arguments.
   * @param options - Additional scope and database options.
   * @returns The count, capped at 10,000, and its precision.
   */
  async count<Entity extends object>(
    connectionClass: ConnectionClass<Entity>,
    args: CountArgsInterface<Entity>,
    options?: ConnectionCountOptions<Entity>,
  ): Promise<Count> {
    const metadata = getConnectionMetadata(connectionClass);
    const { entityClass } = metadata;
    const em = this.em.getContext();
    const { assertMatch, ...scope } = options ?? {};
    const where = getConnectionWhere(metadata, args, scope.where) ?? {};
    const entity = em.getMetadata(entityClass);
    let count: number;
    if (entity.virtual || assertMatch) {
      const matches = await em.find(entityClass, where, {
        ...scope,
        limit: COUNT_LIMIT + 1,
      });
      if (assertMatch) {
        matches.forEach(assertMatch);
      }
      count = matches.length;
    } else {
      count = await this.countStoredEntities(em, entity, where, scope);
    }

    return {
      count: Math.min(count, COUNT_LIMIT),
      precision:
        count > COUNT_LIMIT ? CountPrecision.AT_LEAST : CountPrecision.EXACT,
    };
  }

  private async countStoredEntities<Entity extends object>(
    em: SqlEntityManager,
    entity: EntityMetadata<Entity>,
    where: FilterQuery<Entity>,
    options?: ConnectionCountOptions<Entity>,
  ): Promise<number> {
    const sqlDriver = em.getDriver();
    const ctx = em.getTransactionContext();
    // Use the same filter and join planning as a normal MikroORM read.
    /* eslint-disable @typescript-eslint/dot-notation */
    const readOptions = em["prepareOptions"]<FindOptions<Entity>>({
      ...options,
    });
    await em.tryFlush(entity.class, readOptions);
    const filteredWhere = await em["processWhere"](
      entity.class,
      where,
      readOptions,
      "read",
    );
    const populate = await em.preparePopulate(entity.class, readOptions);
    const populateFilter = await em["getJoinedFilters"](entity, {
      ...readOptions,
      populate: populate as never,
    });
    const populateWhere = em["createPopulateWhere"](
      { ...filteredWhere } as ObjectQuery<Entity>,
      readOptions,
    );
    const connectionType = sqlDriver["resolveConnectionType"]({
      ctx,
      connectionType: readOptions.connectionType,
    });
    /* eslint-enable @typescript-eslint/dot-notation */

    const driver = sqlDriver as unknown as SqlReadPlanner<Entity>;
    const matches = await driver.createQueryBuilderFromOptions(
      entity,
      filteredWhere,
      {
        ...readOptions,
        em,
        ctx,
        populate: populate as never,
        _populateWhere:
          readOptions.populateWhere ?? em.config.get("populateWhere"),
        populateWhere,
        populateFilter,
      },
    );
    matches
      .setFlag(QueryFlag.DISABLE_PAGINATE)
      .select(entity.primaryKeys, Object.keys(matches.getAliasMap()).length > 1)
      .orderBy([])
      .limit(COUNT_LIMIT + 1);

    // The outer aggregate has no entity metadata, so it applies no discriminator or filters.
    const { sql, params } = em
      .getPlatform()
      .createNativeQueryBuilder()
      .from(matches.getNativeQuery().as("bounded_count"))
      .count()
      .compile();
    const connection = sqlDriver.getConnection(connectionType);
    const loggerContext = {
      ...readOptions.loggerContext,
      signal: readOptions.signal,
      inflightQueryAbortStrategy: readOptions.inflightQueryAbortStrategy,
    };
    const execute = (transaction?: Transaction) =>
      connection.execute<{ count: number | string }>(
        sql,
        params,
        "get",
        transaction,
        loggerContext,
      );
    const sessionContext = ctx ? undefined : em.getTransactionSessionContext();
    const result = sessionContext
      ? await connection.transactional(execute, {
          loggerContext,
          sessionContext,
        })
      : await execute(ctx);
    return Number(result.count);
  }
}
