/* eslint-disable @typescript-eslint/no-generated-empty-object-type -- MikroORM QueryOrderMap resolves its fields only after the entity generic is supplied. */
import {
  type FilterQuery,
  type FindOptions,
  QueryOrder,
  type QueryOrderMap,
} from "@mikro-orm/core";
import { type SqlEntityManager } from "@mikro-orm/sql";
import { GraphQLBadUserInputError } from "@nest-boot/graphql";
import { get, set } from "lodash-es";

import { type ConnectionFindOptions } from "./connection.manager.js";
import { Cursor } from "./cursor.js";
import { OrderDirection, PagingType } from "./enums/index.js";
import {
  ConnectionArgsInterface,
  ConnectionMetadata,
  ConnectionResult,
  EdgeInterface,
} from "./interfaces/index.js";
import { ConnectionClass } from "./types/index.js";
import {
  getConnectionMetadata,
  getConnectionWhere,
} from "./utils/connection-filters.js";
import { resolveConnectionPagination } from "./utils/resolve-connection-pagination.js";

/**
 * Builds and executes paginated queries for GraphQL connections.
 *
 * This class handles the complexity of cursor-based pagination including:
 * - Forward and backward pagination
 * - Custom ordering with fallback to ID ordering
 * - Filter query construction from multiple sources (args, options, query string)
 * - Cursor encoding/decoding for stable pagination
 *
 * This class is used internally by ConnectionManager
 * @template Entity - The entity type being queried
 * @template Hint - Type hints for population
 * @template Fields - Fields to select
 * @template Excludes - Fields to exclude
 * @internal
 */
export class ConnectionQueryBuilder<
  Entity extends object,
  Hint extends string = never,
  Fields extends string = "*",
  Excludes extends string = never,
> {
  private readonly metadata: ConnectionMetadata<Entity>;

  private readonly limit: number;

  private readonly cursor: Cursor | null = null;

  private readonly pagingType: PagingType;

  private readonly queryOrder: QueryOrder;

  private readonly queryOrderMap: QueryOrderMap<Entity>[] = [];

  private readonly findOptions: FindOptions<Entity, Hint, Fields, Excludes>;

  private readonly allFilterQuery: FilterQuery<Entity> | null = null;

  constructor(
    private readonly entityManager: SqlEntityManager,
    connectionClass: ConnectionClass<Entity>,
    private readonly args: ConnectionArgsInterface<Entity>,
    private readonly options?: ConnectionFindOptions<
      Entity,
      Hint,
      Fields,
      Excludes
    >,
  ) {
    this.metadata = getConnectionMetadata(connectionClass);

    const pagination = resolveConnectionPagination(args);
    if ("error" in pagination) {
      throw new GraphQLBadUserInputError(pagination.error);
    }
    const { limit, pagingType } = pagination;
    this.limit = limit;
    this.pagingType = pagingType;
    const cursor = pagingType === PagingType.FORWARD ? args.after : args.before;
    this.cursor = cursor == null ? null : new Cursor(cursor);
    this.queryOrder = this.getQueryOrder();
    this.queryOrderMap = this.getQueryOrderMap();
    this.findOptions = this.getFindOptions();

    this.allFilterQuery = getConnectionWhere(
      this.metadata,
      args,
      options?.where,
      this.getCursorFilterQuery(),
    );
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
    if (this.args.orderBy == null) {
      return [
        {
          id: this.queryOrder,
        } as QueryOrderMap<Entity>,
      ];
    }

    const queryOrderMap: QueryOrderMap<Entity>[] = [
      set({}, this.args.orderBy.field, this.queryOrder),
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

    if (
      this.args.orderBy == null ||
      typeof this.cursor?.value === "undefined"
    ) {
      return idFilterQuery;
    }

    const { field } = this.args.orderBy;
    const value = this.cursor.value;
    const sameValue = set({}, field, { $eq: value });
    const tieBreak =
      idFilterQuery === null ? sameValue : { $and: [sameValue, idFilterQuery] };
    // Follow the platform's native placement, which reverses for backward paging.
    const nullsFirst =
      this.entityManager.getPlatform().sortsNullsLowest() ===
      (this.queryOrder === QueryOrder.ASC);

    if (value === null) {
      return (
        nullsFirst
          ? { $or: [set({}, field, { $ne: null }), tieBreak] }
          : tieBreak
      ) as FilterQuery<Entity>;
    }

    return {
      $or: [
        set({}, field, { [cursorOperator]: value }),
        tieBreak,
        ...(nullsFirst ? [] : [set({}, field, { $eq: null })]),
      ],
    } as FilterQuery<Entity>;
  }

  private findPage(): Promise<Entity[]> {
    return this.allFilterQuery === null
      ? this.entityManager.findAll(
          this.metadata.entityClass,
          this.findOptions as never,
        )
      : this.entityManager.find(
          this.metadata.entityClass,
          this.allFilterQuery as never,
          this.findOptions as never,
        );
  }

  /**
   * Executes the paginated query and returns the connection result.
   * @returns A promise that resolves to the page of edges and its pagination info.
   */
  async query(): Promise<ConnectionResult<Entity>> {
    const entities = await this.findPage();

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
      node: node,
      cursor: new Cursor({
        id: (node as any)?.id,
        ...(this.args.orderBy != null
          ? { value: get(node, this.args.orderBy.field) }
          : {}),
      }).toString(),
    }));

    // Return collection
    return {
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
