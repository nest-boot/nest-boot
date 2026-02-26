import { EntityClass } from "@mikro-orm/core";
import { type Type } from "@nestjs/common";
import { GraphQLScalarType } from "graphql";
import type { FieldType } from "mikro-orm-filter-query-schema";
import type { ZodType } from "zod";

import {
  ConnectionArgsInterface,
  ConnectionBuilderOptions,
  ConnectionInterface,
  EdgeInterface,
  FieldOptions,
  OrderFieldType,
  OrderInterface,
} from "./interfaces";
import {
  createConnection,
  createConnectionArgs,
  createEdge,
  createFilter,
  createOrder,
} from "./utils";

/**
 * The result of building a connection with ConnectionBuilder.
 *
 * Contains all the GraphQL types needed for cursor-based pagination,
 * including dynamic named types based on the entity name.
 *
 * @typeParam Entity - The entity type for the connection
 */
export type ConnectionBuildResult<Entity extends object> = {
  Connection: Type<ConnectionInterface<Entity>>;
  ConnectionArgs: Type<ConnectionArgsInterface<Entity>>;
  Edge: Type<EdgeInterface<Entity>>;
  Filter: GraphQLScalarType;
  filterQuerySchema: ZodType<any>;
  Order: Type<OrderInterface<Entity>>;
  OrderField?: OrderFieldType<Entity>;
} & Record<
  `${EntityClass<Entity>["name"]}Connection`,
  Type<ConnectionInterface<Entity>>
> &
  Record<
    `${EntityClass<Entity>["name"]}ConnectionArgs`,
    Type<ConnectionArgsInterface<Entity>>
  > &
  Record<`${EntityClass<Entity>["name"]}Edge`, Type<EdgeInterface<Entity>>> &
  Record<`${EntityClass<Entity>["name"]}Order`, Type<OrderInterface<Entity>>> &
  Record<`${EntityClass<Entity>["name"]}OrderField`, OrderFieldType<Entity>> &
  Record<`${EntityClass<Entity>["name"]}Filter`, GraphQLScalarType>;

/**
 * Builder class for creating GraphQL connection types following the Relay specification.
 *
 * The ConnectionBuilder generates all necessary GraphQL types for cursor-based pagination:
 * - Connection type with edges, pageInfo, and totalCount
 * - Edge type with node and cursor
 * - ConnectionArgs type with first, last, after, before, orderBy, filter, and query
 * - Order input type for sorting
 * - Filter scalar type for MongoDB-style filtering
 *
 * @typeParam Entity - The MikroORM entity type for the connection
 *
 * @example Basic usage
 * ```typescript
 * import { ConnectionBuilder } from "@nest-boot/graphql-connection";
 * import { User } from "./user.entity";
 *
 * const { Connection, ConnectionArgs, Edge } = new ConnectionBuilder(User)
 *   .addField({ field: "name", type: "string", filterable: true, sortable: true })
 *   .addField({ field: "createdAt", type: "date", sortable: true })
 *   .build();
 *
 * // Use in resolver
 * @Query(() => Connection)
 * async users(@Args() args: typeof ConnectionArgs) {
 *   return this.connectionManager.find(Connection, args);
 * }
 * ```
 *
 * @example With custom filter options
 * ```typescript
 * const { Connection, ConnectionArgs } = new ConnectionBuilder(User, {
 *   filter: {
 *     maxDepth: 3,
 *     maxConditions: 10,
 *   },
 * })
 *   .addField({ field: "email", type: "string", filterable: true })
 *   .build();
 * ```
 */
export class ConnectionBuilder<Entity extends object> {
  private readonly entityName: EntityClass<Entity>["name"];

  private readonly options: ConnectionBuilderOptions;

  private readonly fieldOptionsMap = new Map<
    string,
    FieldOptions<Entity, FieldType, string>
  >();

  /**
   * Creates a new ConnectionBuilder instance.
   *
   * @param entityClass - The MikroORM entity class to build connection types for
   * @param options - Optional configuration for the connection builder
   */
  constructor(
    private readonly entityClass: EntityClass<Entity>,
    options?: Partial<ConnectionBuilderOptions>,
  ) {
    this.entityName = entityClass.name;

    this.options = {
      ...options,
      filter: {
        maxDepth: 5,
        maxConditions: 20,
        maxOrBranches: 5,
        maxArrayLength: 100,
        ...options?.filter,
      },
    };
  }

  /**
   * Adds a field configuration to the connection builder.
   *
   * Fields can be configured for filtering, sorting, and searching.
   * The field type determines what filter operators are available.
   *
   * @typeParam Type - The field type ("string", "number", "boolean", or "date")
   * @typeParam Field - The field path in the entity
   * @param options - The field configuration options
   * @returns The builder instance for method chaining
   *
   * @example
   * ```typescript
   * builder
   *   .addField({ field: "name", type: "string", filterable: true, searchable: true })
   *   .addField({ field: "age", type: "number", filterable: true, sortable: true })
   *   .addField({ field: "isActive", type: "boolean", filterable: true })
   *   .addField({ field: "createdAt", type: "date", sortable: true });
   * ```
   */
  addField<
    Type extends "string" | "number" | "boolean" | "date" = never,
    Field extends string = never,
  >(options: FieldOptions<Entity, Type, Field>): this {
    this.fieldOptionsMap.set(
      options.field,
      options as FieldOptions<Entity, FieldType, string>,
    );
    return this;
  }

  /**
   * Builds and returns all GraphQL types for the connection.
   *
   * The returned object contains both generic type references and
   * entity-specific named types (e.g., UserConnection, UserEdge).
   *
   * @returns An object containing all generated connection types
   */
  build(): ConnectionBuildResult<Entity> {
    const Edge = createEdge(this.entityClass, this.entityName);

    const { Order, OrderField } = createOrder(
      this.entityName,
      this.fieldOptionsMap,
    );

    const { Filter, filterQuerySchema } = createFilter(
      this.entityName,
      this.fieldOptionsMap,
      this.options?.filter,
    );

    const Connection = createConnection(
      this.entityClass,
      this.entityName,
      Edge,
      this.fieldOptionsMap,
      filterQuerySchema,
    );

    const ConnectionArgs = createConnectionArgs(
      this.entityName,
      this.fieldOptionsMap,
      Order,
      Filter,
    );

    return {
      Connection,
      ConnectionArgs,
      Edge,
      Filter,
      filterQuerySchema,
      Order,
      OrderField,
      [`${this.entityName}Connection`]: Connection,
      [`${this.entityName}ConnectionArgs`]: ConnectionArgs,
      [`${this.entityName}Edge`]: Edge,
      [`${this.entityName}Filter`]: Filter,
      [`${this.entityName}Order`]: Order,
      [`${this.entityName}OrderField`]: OrderField,
    } as ConnectionBuildResult<Entity>;
  }
}
