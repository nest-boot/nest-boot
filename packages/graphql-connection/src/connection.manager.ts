import {
  EntityManager,
  type FilterQuery,
  type FindOptions,
  QueryFlag,
} from "@mikro-orm/core";
import type { SqlEntityManager } from "@mikro-orm/sql";
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

/** SQL options shared by paginated reads and counts. */
export type ConnectionCountOptions<Entity extends object> = Pick<
  ConnectionFindOptions<Entity>,
  "where" | "schema" | "filters"
>;

const COUNT_LIMIT = 10_000;

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
    const where = getConnectionWhere(metadata, args, options?.where);
    const entity = em.getMetadata(entityClass);

    // Reuse the read planning hooks used by MikroORM's find() before adding the SQL limit.
    /* eslint-disable @typescript-eslint/dot-notation */
    const readOptions = em["prepareOptions"]({ ...options });
    await em.tryFlush(entityClass, {});
    const filteredWhere = await em["processWhere"](
      entityClass,
      where ?? {},
      readOptions,
      "read",
    );
    const populate = await em.preparePopulate(entityClass, readOptions);
    const populateFilter = await em["getJoinedFilters"](entity, {
      ...readOptions,
      populate: populate as never,
    });
    /* eslint-enable @typescript-eslint/dot-notation */

    const matches = em.createQueryBuilder(entityClass);
    matches
      .unsetFlag(QueryFlag.CONVERT_CUSTOM_TYPES)
      .select(entity.primaryKeys)
      .withSchema(em.getDriver().getSchemaName(entity, readOptions))
      .populate(populate, undefined, populateFilter)
      .where(filteredWhere)
      .limit(COUNT_LIMIT + 1);
    await matches.applyJoinedFilters(em, readOptions.filters);
    const count = await em
      .createQueryBuilder(matches, "bounded_count")
      .count()
      .getCount();

    return {
      count: Math.min(count, COUNT_LIMIT),
      precision:
        count > COUNT_LIMIT ? CountPrecision.AT_LEAST : CountPrecision.EXACT,
    };
  }
}
