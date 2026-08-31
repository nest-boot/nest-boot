import {
  type FilterQuery,
  type FindOptions,
  QueryOrder,
  type QueryOrderMap,
} from "@mikro-orm/core";
import { type SqlEntityManager } from "@mikro-orm/sql";
import { compact, get, set } from "lodash-es";
import { parse, type ParseOptions } from "search-syntax";

import { type ConnectionFindOptions } from "./connection.manager.js";
import { Cursor } from "./cursor.js";
import {
  OrderDirection,
  PagingType,
  TotalCountRelation,
} from "./enums/index.js";
import { GRAPHQL_CONNECTION_METADATA } from "./graphql-connection.constants.js";
import {
  ConnectionArgsInterface,
  ConnectionMetadata,
  ConnectionResult,
  EdgeInterface,
} from "./interfaces/index.js";
import { ConnectionClass } from "./types/index.js";

const TOTAL_COUNT_LIMIT = 10_000;

/**
 * Builds and executes paginated queries for GraphQL connections.
 *
 * This class handles the complexity of cursor-based pagination including:
 * - Forward and backward pagination
 * - Custom ordering with fallback to ID ordering
 * - Filter query construction from multiple sources (args, options, query string)
 * - Cursor encoding/decoding for stable pagination
 *
 * @typeParam Entity - The entity type being queried
 * @typeParam Hint - Type hints for population
 * @typeParam Fields - Fields to select
 * @typeParam Excludes - Fields to exclude
 *
 * @internal This class is used internally by ConnectionManager
 */
export class ConnectionQueryBuilder<
  Entity extends object,
  Hint extends string = never,
  Fields extends string = "*",
  Excludes extends string = never,
> {
  private readonly metadata: ConnectionMetadata<Entity>;

  private readonly limit: number = 0;

  private readonly cursor: Cursor | null = null;

  private readonly pagingType: PagingType;

  private readonly queryOrder: QueryOrder;

  private readonly queryOrderMap: QueryOrderMap<Entity>[] = [];

  private readonly findOptions: FindOptions<Entity, Hint, Fields, Excludes>;

  private readonly optionFilterQuery: FilterQuery<Entity> | null = null;

  private readonly cursorFilterQuery: FilterQuery<Entity> | null = null;

  private readonly queryStringFilterQuery: FilterQuery<Entity> | null = null;

  private readonly argsFilterQuery: FilterQuery<Entity> | null = null;

  private readonly totalCountFilterQuery: FilterQuery<Entity> | null = null;

  private readonly allFilterQuery: FilterQuery<Entity> | null = null;

  constructor(
    private readonly entityManager: SqlEntityManager,
    private readonly connectionClass: ConnectionClass<Entity>,
    private readonly args: ConnectionArgsInterface<Entity>,
    private readonly options?: ConnectionFindOptions<
      Entity,
      Hint,
      Fields,
      Excludes
    >,
    private readonly includeTotalCount = true,
  ) {
    this.metadata = Reflect.getMetadata(
      GRAPHQL_CONNECTION_METADATA,
      connectionClass,
    );

    if (typeof this.metadata === "undefined") {
      throw new Error("Connection metadata not found");
    }

    this.limit = this.getLimit();
    this.cursor = this.getCursor();
    this.pagingType = this.getPagingType();
    this.queryOrder = this.getQueryOrder();
    this.queryOrderMap = this.getQueryOrderMap();
    this.findOptions = this.getFindOptions();

    this.optionFilterQuery = this.options?.where ?? null;
    this.cursorFilterQuery = this.getCursorFilterQuery();
    this.queryStringFilterQuery = this.getQueryStringToFilterQuery();
    this.argsFilterQuery = this.args.filter ?? null;

    this.totalCountFilterQuery = this.mergeFilterQuery(
      compact([
        this.optionFilterQuery,
        this.queryStringFilterQuery,
        this.argsFilterQuery,
      ]),
    );

    this.allFilterQuery = this.mergeFilterQuery(
      compact([
        this.cursorFilterQuery,
        this.optionFilterQuery,
        this.queryStringFilterQuery,
        this.argsFilterQuery,
      ]),
    );
  }

  private getLimit(): number {
    return this.args.first ?? this.args.last ?? 0;
  }

  private getCursor(): Cursor | null {
    return this.args.after != null
      ? new Cursor(this.args.after)
      : this.args.before != null
        ? new Cursor(this.args.before)
        : null;
  }

  private getPagingType(): PagingType {
    const { first, last, after, before } = this.args;

    const isForwardPaging =
      typeof first === "number" || typeof after === "string";
    const isBackwardPaging =
      typeof last === "number" || typeof before === "string";

    if (isForwardPaging && isBackwardPaging) {
      if (
        (isForwardPaging && before != null) ||
        (isBackwardPaging && after != null)
      ) {
        throw new Error("paging must use either first/after or last/before");
      } else {
        throw new Error(
          "cursor-based pagination cannot be forwards AND backwards",
        );
      }
    }

    return isBackwardPaging ? PagingType.BACKWARD : PagingType.FORWARD;
  }

  private getQueryOrder(): QueryOrder {
    const direction = this.args.orderBy?.direction ?? OrderDirection.ASC;

    return (
      this.pagingType === PagingType.FORWARD
        ? direction === OrderDirection.ASC
        : direction === OrderDirection.DESC
    )
      ? QueryOrder.ASC
      : QueryOrder.DESC;
  }

  private getQueryOrderMap(): QueryOrderMap<Entity>[] {
    if (typeof this.args.orderBy === "undefined") {
      return [
        {
          id: this.queryOrder,
        } as QueryOrderMap<Entity>,
      ];
    }

    const queryOrderMap: QueryOrderMap<Entity>[] = [
      set(
        {},
        this.args.orderBy.field,
        this.queryOrder,
      ) as QueryOrderMap<Entity>,
    ];

    if ((this.args.orderBy.field as string) !== "id") {
      queryOrderMap.push({
        id: this.queryOrder,
      } as QueryOrderMap<Entity>);
    }

    return queryOrderMap;
  }

  private getFindOptions(): FindOptions<Entity, Hint, Fields, Excludes> {
    return {
      ...(this.options ?? {}),
      limit: this.limit + 1,
      orderBy: this.queryOrderMap,
    };
  }

  private getCursorFilterQuery(): FilterQuery<Entity> | null {
    const cursorOperator = this.queryOrder === QueryOrder.ASC ? "$gt" : "$lt";
    const idFilterQuery: FilterQuery<Entity> | null =
      typeof this.cursor?.id !== "undefined"
        ? ({
            id: {
              [cursorOperator]: this.cursor.id,
            },
          } as unknown as FilterQuery<Entity>)
        : null;

    return typeof this.args.orderBy !== "undefined" &&
      typeof this.cursor?.value !== "undefined"
      ? ({
          $or: [
            set({}, this.args.orderBy.field, {
              [cursorOperator]: this.cursor.value,
            }),
            idFilterQuery !== null
              ? {
                  $and: [
                    set({}, this.args.orderBy.field, {
                      $eq: this.cursor.value,
                    }),
                    idFilterQuery,
                  ],
                }
              : set({}, this.args.orderBy.field, { $eq: this.cursor.value }),
          ],
        } as FilterQuery<Entity>)
      : idFilterQuery;
  }

  private getQueryStringToFilterQuery(): FilterQuery<Entity> | null {
    if (
      typeof this.args.query !== "undefined" &&
      this.args.query.trim() !== ""
    ) {
      const { fieldOptionsMap, filterQuerySchema } = this.metadata;

      // Build ParseOptions, only include filterable fields
      const fields: ParseOptions["fields"] = {};
      for (const [key, options] of fieldOptionsMap) {
        if (options.filterable === true) {
          fields[key] = {
            type: options.type,
            array: options.array,
            searchable: options.searchable,
            ...("fulltext" in options
              ? { fulltext: Boolean(options.fulltext) }
              : {}),
            ...("prefix" in options ? { prefix: options.prefix } : {}),
          };
        }
      }

      const rawFilter = parse(this.args.query, { fields });

      if (rawFilter === null) {
        return null;
      }

      return filterQuerySchema.parse(rawFilter);
    }

    return null;
  }

  private mergeFilterQuery(
    filterQueryGroup: FilterQuery<Entity>[],
  ): FilterQuery<Entity> | null {
    if (filterQueryGroup.length === 0) {
      return null;
    }

    if (filterQueryGroup.length === 1) {
      return filterQueryGroup[0];
    }

    return {
      $and: filterQueryGroup,
    } as FilterQuery<Entity>;
  }

  private async getTotalCount(): Promise<number> {
    const limitedCountQueryBuilder = this.entityManager
      .createQueryBuilder(this.metadata.entityClass)
      .select("id" as never)
      .limit(TOTAL_COUNT_LIMIT + 1)
      .withSchema(this.options?.schema);

    if (this.totalCountFilterQuery !== null) {
      limitedCountQueryBuilder.where(this.totalCountFilterQuery as never);
    }

    await limitedCountQueryBuilder.applyFilters(this.options?.filters);

    return await this.entityManager
      .createQueryBuilder(limitedCountQueryBuilder as never, "bounded_count")
      .count()
      .getCount();
  }

  /**
   * Executes the paginated query and returns the connection result.
   *
   * @returns A promise that resolves to the connection with edges, pageInfo,
   * totalCount, and totalCountRelation
   */
  async query(): Promise<ConnectionResult<Entity>> {
    const matchedCountPromise = this.includeTotalCount
      ? this.getTotalCount()
      : Promise.resolve(undefined);
    const [entities, matchedCount] = await Promise.all([
      this.allFilterQuery === null
        ? this.entityManager.findAll(
            this.metadata.entityClass,
            this.findOptions as never,
          )
        : this.entityManager.find(
            this.metadata.entityClass,
            this.allFilterQuery as never,
            this.findOptions as never,
          ),
      matchedCountPromise,
    ]);

    const totalCountFields =
      typeof matchedCount === "undefined"
        ? {}
        : {
            totalCount: Math.min(matchedCount, TOTAL_COUNT_LIMIT),
            totalCountRelation:
              matchedCount > TOTAL_COUNT_LIMIT
                ? TotalCountRelation.GTE
                : TotalCountRelation.EQ,
          };

    // Re-sort results
    const sortedEntities =
      this.pagingType === PagingType.FORWARD ? entities : entities.reverse();

    // Generate edges from results
    const edges = (
      sortedEntities.length > this.limit
        ? this.pagingType === PagingType.FORWARD
          ? sortedEntities.slice(0, -1)
          : sortedEntities.slice(1)
        : sortedEntities
    ).map<EdgeInterface<Entity>>((node) => ({
      node: node as Entity,
      cursor: new Cursor({
        id: (node as any)?.id,
        ...(typeof this.args.orderBy !== "undefined"
          ? { value: get(node, this.args.orderBy.field) }
          : {}),
      }).toString(),
    }));

    // Return collection
    return {
      ...totalCountFields,
      edges,
      pageInfo: {
        ...(this.pagingType === PagingType.FORWARD
          ? {
              hasNextPage: sortedEntities.length > this.limit,
              hasPreviousPage: this.cursor != null,
            }
          : {
              hasNextPage: this.cursor != null,
              hasPreviousPage: sortedEntities.length > this.limit,
            }),
        startCursor: edges[0]?.cursor,
        endCursor: edges[edges.length - 1]?.cursor,
      },
    };
  }
}
