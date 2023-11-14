import { SearchableOptions } from "@nest-boot/search";
import { SEARCHABLE_OPTIONS } from "@nest-boot/search/dist/search.constants";
import { type Type } from "@nestjs/common";
import {
  ArgsType,
  Field,
  InputType,
  Int,
  ObjectType,
  registerEnumType,
} from "@nestjs/graphql";
import { humanize, pluralize } from "inflection";
import _ from "lodash";

import { PageInfo } from "./dtos";
import { OrderDirection } from "./enums";
import {
  type ConnectionArgsInterface,
  type ConnectionInterface,
  type EdgeInterface,
  OrderFieldKey,
  type OrderFieldType,
  type OrderFieldValue,
  type OrderInterface,
} from "./interfaces";

interface ConnectionBuilderOptions<T> {
  orderFields: OrderFieldValue<T>[];
}

interface ConnectionBuildResult<T extends { id: number | string | bigint }> {
  Connection: Type<ConnectionInterface<T>>;
  ConnectionArgs: Type<ConnectionArgsInterface<T>>;
  Edge: Type<EdgeInterface<T>>;
  Order: Type<OrderInterface<T>>;
  OrderField?: OrderFieldType<T>;
}

export class ConnectionBuilder<T extends { id: number | string | bigint }> {
  private readonly entityName: string;
  private readonly searchableOptions?: SearchableOptions<T>;
  private readonly supportedFilterParameters: string[] = [];

  constructor(
    private readonly entityClass: Type<T>,
    private readonly options: ConnectionBuilderOptions<T>,
  ) {
    this.entityName = entityClass.name;

    this.searchableOptions = Reflect.getMetadata(
      SEARCHABLE_OPTIONS,
      this.entityClass,
    );

    this.supportedFilterParameters.push(
      ...Object.keys(this.searchableOptions?.aliasFields ?? {}),
      ...(this.searchableOptions?.filterableFields ?? []),
    );
    this.supportedFilterParameters = _.sortedUniq(
      this.supportedFilterParameters,
    );
  }

  build(): ConnectionBuildResult<T> {
    @ObjectType(`${this.entityName}Edge`, {
      description: `An auto-generated type which holds one ${this.entityName} and a cursor during pagination.`,
    })
    class Edge implements EdgeInterface<T> {
      @Field(() => this.entityClass, {
        description: `The item at the end of ${this.entityName}Edge.`,
      })
      node!: T;

      @Field({ complexity: 0, description: `A cursor for use in pagination.` })
      cursor!: string;
    }

    @ObjectType(`${this.entityName}Connection`, {
      isAbstract: true,
      description: `An auto-generated type for paginating through multiple ${pluralize(
        this.entityName,
      )}.`,
    })
    class Connection implements ConnectionInterface<T> {
      @Field(() => [Edge], { complexity: 0, description: `A list of edges.` })
      edges!: Edge[];

      @Field({
        complexity: 0,
        description: `Information to aid in pagination.`,
      })
      pageInfo!: PageInfo;

      @Field(() => Int, {
        complexity: 0,
        description: `Identifies the total count of items in the connection.`,
      })
      totalCount!: number;
    }

    const OrderField =
      this.options.orderFields.length > 0
        ? this.options.orderFields.reduce<OrderFieldType<T>>(
            (result, field) => ({
              ...result,
              [_.snakeCase(field.replace(/_/g, ".")).toUpperCase()]: field,
            }),
            // eslint-disable-next-line @typescript-eslint/prefer-reduce-type-parameter
            {} as any,
          )
        : undefined;

    if (typeof OrderField !== "undefined") {
      registerEnumType(OrderField, {
        name: `${this.entityName}OrderField`,
        description: `Properties by which ${humanize(
          this.entityName,
          true,
        )} connections can be ordered.`,
      });
    }

    @InputType(`${this.entityName}Order`, {
      description: `Ordering options for ${humanize(
        this.entityName,
        true,
      )} connections`,
    })
    class Order implements OrderInterface<T> {
      @Field(() => OrderField ?? String, {
        description: `The field to order ${pluralize(
          humanize(this.entityName, true),
        )} by.`,
      })
      field!: OrderFieldKey<T>;

      @Field(() => OrderDirection, { description: `The ordering direction.` })
      direction!: OrderDirection;
    }

    @ArgsType()
    class ConnectionArgs implements ConnectionArgsInterface<T> {
      @Field({
        nullable: true,
        ...(this.supportedFilterParameters.length > 0
          ? {
              description: `Supported filter parameters:\n${this.supportedFilterParameters
                .map((parameter) => `* \`${parameter}\``)
                .join("\n")}`,
            }
          : {}),
      })
      query?: string;

      @Field(() => Int, {
        nullable: true,
        description: "Returns up to the first `n` elements from the list.",
      })
      first?: number;

      @Field(() => Int, {
        nullable: true,
        description: "Returns up to the last `n` elements from the list.",
      })
      last?: number;

      @Field({
        nullable: true,
        description: `Returns the elements that come after the specified cursor.`,
      })
      after?: string;

      @Field({
        nullable: true,
        description: `Returns the elements that come before the specified cursor.`,
      })
      before?: string;

      @Field(() => Order, {
        nullable: true,
        description: `Ordering options for the returned topics.`,
      })
      orderBy?: Order;
    }

    return {
      Connection,
      ConnectionArgs,
      Edge,
      Order,
      OrderField,
    };
  }
}
