import {
  EntityManager,
  EntityProperty,
  FilterQuery,
  FindOptions,
  QueryOrder,
  QueryOrderMap,
} from "@mikro-orm/core";
import { SqlEntityManager } from "@mikro-orm/knex";
import compact from "lodash/compact";
import get from "lodash/get";
import set from "lodash/set";

import { ConnectionFindOptions } from "./connection.manager";
import { Cursor } from "./cursor";
import { OrderDirection, PagingType } from "./enums";
import { GRAPHQL_CONNECTION_METADATA } from "./graphql-connection.constants";
import {
  ConnectionArgsInterface,
  ConnectionMetadata,
  EdgeInterface,
  ReplacementFieldOptions,
  ReplacementFunctionFieldOptions,
} from "./interfaces";
import { SearchSyntaxFieldOptions } from "./interfaces/search-syntax-field-options.interface";
import { searchSyntaxLexer } from "./search-syntax.lexer";
import { searchSyntaxParser } from "./search-syntax.parser";
import { SearchSyntaxVisitor } from "./search-syntax.visitor";
import { ConnectionClass } from "./types";

function entityPropertyToSimpleType(
  type: EntityProperty["type"],
): "string" | "number" | "bigint" | "boolean" | "date" {
  switch (type) {
    case "boolean":
    case "BooleanType":
      return "boolean";
    case "number":
    case "IntegerType":
    case "SmallIntType":
    case "MediumIntType":
    case "FloatType":
    case "DoubleType":
      return "number";
    case "Date":
    case "DateType":
    case "DateTimeType":
      return "date";
    case "bigint":
    case "BigIntType":
      return "bigint";
    default:
      return "string";
  }
}

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

  private readonly totalCountFilterQuery: FilterQuery<Entity> | null = null;

  private readonly allFilterQuery: FilterQuery<Entity> | null = null;

  constructor(
    private readonly entityManager: EntityManager,
    private readonly connectionClass: ConnectionClass<Entity>,
    private readonly args: ConnectionArgsInterface<Entity>,
    private readonly options?: ConnectionFindOptions<
      Entity,
      Hint,
      Fields,
      Excludes
    >,
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

    this.totalCountFilterQuery = this.mergeFilterQuery(
      compact([this.optionFilterQuery, this.queryStringFilterQuery]),
    );

    this.allFilterQuery = this.mergeFilterQuery(
      compact([
        this.cursorFilterQuery,
        this.optionFilterQuery,
        this.queryStringFilterQuery,
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
    const idFilterQuery: FilterQuery<Entity> | null =
      typeof this.cursor?.id !== "undefined"
        ? // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          ({
            id: {
              [this.pagingType === PagingType.FORWARD ? "$gt" : "$lt"]:
                this.cursor.id,
            },
          } as unknown as FilterQuery<Entity>)
        : null;

    return typeof this.args.orderBy !== "undefined" &&
      typeof this.cursor?.value !== "undefined"
      ? ({
          $or: [
            set(
              {},
              this.args.orderBy.field,
              (
                this.pagingType === PagingType.FORWARD
                  ? this.args.orderBy.direction === OrderDirection.ASC
                  : this.args.orderBy.direction === OrderDirection.DESC
              )
                ? { $gt: this.cursor.value }
                : { $lt: this.cursor.value },
            ),
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
      const { entityClass, fieldOptionsMap } = this.metadata;

      const entityMetadata = this.entityManager.getMetadata().get(entityClass);

      if (typeof entityMetadata === "undefined") {
        throw new Error("Entity metadata not found");
      }

      const visitor = new SearchSyntaxVisitor(
        this.entityManager,
        [...fieldOptionsMap.values()].reduce((result, fieldOptions) => {
          const replacedField =
            typeof (fieldOptions as any).replacement === "string"
              ? (fieldOptions as any).replacement
              : fieldOptions.field;

          const prop: EntityProperty<Entity> | undefined = get(
            entityMetadata.properties,
            replacedField.split(".").join(".targetMeta.properties."),
          );

          result.set(fieldOptions.field, {
            field: fieldOptions.field,
            type:
              (fieldOptions as ReplacementFunctionFieldOptions<Entity>).type ??
              entityPropertyToSimpleType(prop?.type),
            replacement: (fieldOptions as ReplacementFieldOptions<Entity>)
              .replacement,
            array: fieldOptions.array ?? prop?.array,
            fulltext:
              fieldOptions.fulltext ??
              entityMetadata.indexes.some(
                ({ type, properties }) =>
                  type === "fulltext" && properties === replacedField,
              ),
            searchable: fieldOptions.searchable,
            filterable: fieldOptions.filterable,
          });

          return result;
        }, new Map<string, SearchSyntaxFieldOptions<Entity, any, any>>()),
      );

      searchSyntaxParser.input = searchSyntaxLexer.tokenize(
        this.args.query,
      ).tokens;

      if (searchSyntaxParser.errors.length > 0) {
        throw Error(searchSyntaxParser.errors[0].message);
      }

      return visitor.visit(searchSyntaxParser.query()) ?? null;
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

  async query() {
    let [entities, totalCount] = await Promise.all([
      this.allFilterQuery === null
        ? this.entityManager.findAll(
            this.metadata.entityClass,
            this.findOptions,
          )
        : this.entityManager.find(
            this.metadata.entityClass,
            this.allFilterQuery,
            this.findOptions,
          ),
      (this.entityManager as unknown as SqlEntityManager)
        .createQueryBuilder(
          this.totalCountFilterQuery === null
            ? (this.entityManager as unknown as SqlEntityManager)
                .createQueryBuilder(this.metadata.entityClass)
                .select("id")
                .limit(10000)
            : (this.entityManager as unknown as SqlEntityManager)
                .createQueryBuilder(this.metadata.entityClass)
                .select("id")
                .andWhere(this.totalCountFilterQuery)
                .limit(10000),
        )
        .count(),
    ]);

    // 重新排序结果
    entities =
      this.pagingType === PagingType.FORWARD ? entities : entities.reverse();

    // 根据结果生成 edges
    const edges = (
      entities.length > this.limit
        ? this.pagingType === PagingType.FORWARD
          ? entities.slice(0, -1)
          : entities.slice(1)
        : entities
    ).map<EdgeInterface<Entity>>((node) => ({
      node: node as Entity,
      cursor: new Cursor({
        id: (node as any)?.id,
        ...(typeof this.args.orderBy !== "undefined"
          ? { value: get(node, this.args.orderBy.field) }
          : {}),
      }).toString(),
    }));

    // 返回集合
    return {
      totalCount,
      edges,
      pageInfo: {
        ...(this.pagingType === PagingType.FORWARD
          ? {
              hasNextPage: entities.length > this.limit,
              hasPreviousPage: this.cursor != null,
            }
          : {
              hasNextPage: this.cursor != null,
              hasPreviousPage: entities.length > this.limit,
            }),
        startCursor: edges[0]?.cursor,
        endCursor: edges[edges.length - 1]?.cursor,
      },
    };
  }
}
