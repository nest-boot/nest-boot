import { type Type } from "@nestjs/common";
import {
  ArgsType,
  Field,
  InputType,
  Int,
  ObjectType,
  registerEnumType,
} from "@nestjs/graphql";
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

  constructor(
    private readonly entityClass: Type<T>,
    private readonly options: ConnectionBuilderOptions<T>,
  ) {
    this.entityName = entityClass.name;
  }

  build(): ConnectionBuildResult<T> {
    @ObjectType(`${this.entityName}Edge`)
    class Edge implements EdgeInterface<T> {
      @Field(() => this.entityClass)
      node!: T;

      @Field({ complexity: 0 })
      cursor!: string;
    }

    @ObjectType(`${this.entityName}Connection`, { isAbstract: true })
    class Connection implements ConnectionInterface<T> {
      @Field(() => [Edge])
      edges!: Edge[];

      @Field({ complexity: 0 })
      pageInfo!: PageInfo;

      @Field(() => Int, { complexity: 0 })
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
      });
    }

    @InputType(`${this.entityName}Order`)
    class Order implements OrderInterface<T> {
      @Field(() => OrderField ?? String)
      field!: OrderFieldKey<T>;

      @Field(() => OrderDirection)
      direction!: OrderDirection;
    }

    @ArgsType()
    class ConnectionArgs implements ConnectionArgsInterface<T> {
      @Field({ nullable: true })
      query?: string;

      @Field(() => Int, { nullable: true })
      first?: number;

      @Field(() => Int, { nullable: true })
      last?: number;

      @Field({ nullable: true })
      after?: string;

      @Field({ nullable: true })
      before?: string;

      @Field(() => Order, { nullable: true })
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
