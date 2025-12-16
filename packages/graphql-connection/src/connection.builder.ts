import type { EntityClass, FilterQuery } from "@mikro-orm/core";
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

type ConnectionBuildResult<Entity extends object> = {
  Connection: Type<ConnectionInterface<Entity>>;
  ConnectionArgs: Type<ConnectionArgsInterface<Entity>>;
  Edge: Type<EdgeInterface<Entity>>;
  Filter: GraphQLScalarType<FilterQuery<Entity>>;
  filterQuerySchema: ZodType<FilterQuery<Entity>>;
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
  Record<
    `${EntityClass<Entity>["name"]}Filter`,
    GraphQLScalarType<FilterQuery<Entity>>
  >;

export class ConnectionBuilder<Entity extends object> {
  private readonly entityName: EntityClass<Entity>["name"];

  private readonly options: ConnectionBuilderOptions;

  private readonly fieldOptionsMap = new Map<
    string,
    FieldOptions<Entity, FieldType, string>
  >();

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
