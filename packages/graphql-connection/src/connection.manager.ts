import {
  EntityManager,
  type FilterQuery,
  QueryOrder,
  QueryOrderMap,
} from "@mikro-orm/core";
import type { FindByCursorOptions } from "@mikro-orm/core/drivers";
import { EntityProperty } from "@mikro-orm/core/typings";
import { Injectable } from "@nestjs/common";
import { get } from "lodash";

import { GRAPHQL_CONNECTION_METADATA } from "./graphql-connection.constants";
import {
  ConnectionArgsInterface,
  ConnectionInterface,
  ConnectionMetadata,
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

export interface ConnectionFindOptions<
  Entity extends object,
  Hint extends string = never,
  Fields extends string = "*",
  Excludes extends string = never,
> extends Exclude<
    FindByCursorOptions<Entity, Hint, Fields, Excludes>,
    "before" | "after" | "first" | "last" | "orderBy"
  > {
  where?: FilterQuery<Entity>;
}

@Injectable()
export class ConnectionManager {
  constructor(private readonly entityManager: EntityManager) {}

  private convertQueryStringToFilterQuery<Entity extends object>(
    connectionMetadata: ConnectionMetadata<Entity>,
    query: string,
  ): FilterQuery<Entity> {
    const { entityClass, fieldOptionsMap } = connectionMetadata;

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

    searchSyntaxParser.input = searchSyntaxLexer.tokenize(query).tokens;

    if (searchSyntaxParser.errors.length > 0) {
      throw Error(searchSyntaxParser.errors[0].message);
    }

    return visitor.visit(searchSyntaxParser.query()) ?? {};
  }

  async find<
    Entity extends object,
    Hint extends string = never,
    Fields extends string = "*",
    Excludes extends string = never,
  >(
    connectionClass: ConnectionClass<Entity>,
    args: ConnectionArgsInterface<Entity, Hint, Fields, Excludes>,
    options?: ConnectionFindOptions<Entity, Hint, Fields, Excludes>,
  ): Promise<ConnectionInterface<Entity>> {
    const connectionMetadata: ConnectionMetadata<Entity> = Reflect.getMetadata(
      GRAPHQL_CONNECTION_METADATA,
      connectionClass,
    );

    if (typeof connectionMetadata === "undefined") {
      throw new Error("Connection metadata not found");
    }

    const orderBy: QueryOrderMap<Entity>[] = [];
    if (typeof args.orderBy === "undefined") {
      orderBy.push({ id: QueryOrder.ASC } as QueryOrderMap<Entity>);
    } else {
      orderBy.push({
        [args.orderBy.field]: args.orderBy.direction,
      } as QueryOrderMap<Entity>);

      if ((args.orderBy.field as string) !== "id") {
        orderBy.push({ id: QueryOrder.ASC } as QueryOrderMap<Entity>);
      }
    }

    let filterQuery: FilterQuery<Entity> = options?.where ?? {};

    if (typeof args.query !== "undefined" && args.query.trim() !== "") {
      const queryFilterQuery = this.convertQueryStringToFilterQuery(
        connectionMetadata,
        args.query,
      );

      filterQuery =
        Object.keys(filterQuery).length === 0
          ? queryFilterQuery
          : ({
              $and: [filterQuery, queryFilterQuery],
            } as FilterQuery<Entity>);
    }

    const cursor = await this.entityManager.findByCursor(
      connectionMetadata.entityClass,
      filterQuery,
      {
        ...options,
        before: args.before,
        after: args.after,
        first: args.first,
        last: args.last,
        orderBy,
      },
    );

    return {
      totalCount: cursor.totalCount,
      edges: cursor.items.map((node) => ({
        node: node as Entity,
        cursor: cursor.from(node),
      })),
      pageInfo: {
        hasNextPage: cursor.hasNextPage,
        hasPreviousPage: cursor.hasPrevPage,
        startCursor: cursor.startCursor,
        endCursor: cursor.endCursor,
      },
    };
  }
}
