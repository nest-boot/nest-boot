import { IdEntity } from "@nest-boot/database";
import { Type } from "@nestjs/common";
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
  ConnectionArgsInterface,
  ConnectionInterface,
  EdgeInterface,
  OrderInterface,
} from "./interfaces";

interface ConnectionBuilderOptions<T, P extends keyof T> {
  orderFields: Array<Extract<P, string>>;
}

type OrderFieldType<T, P extends keyof T> = {
  [field in Uppercase<Extract<P, string>> | Exclude<P, string>]: T[Extract<
    P,
    string
  >];
};

interface ConnectionBuildResult<T, P extends keyof T> {
  Connection: Type<ConnectionInterface<T>>;
  ConnectionArgs: Type<ConnectionArgsInterface<T, P>>;
  Edge: Type<EdgeInterface<T>>;
  Order: Type<OrderInterface<T, P>>;
  OrderField?: OrderFieldType<T, P>;
}

export class ConnectionBuilder<T extends IdEntity, P extends keyof T> {
  private readonly entityName: string;

  constructor(
    private readonly entityClass: Type<T>,
    private readonly options: ConnectionBuilderOptions<T, P>
  ) {
    this.entityName = entityClass.name;
  }

  build(): ConnectionBuildResult<T, P> {
    @ObjectType(`${this.entityName}Edge`)
    class Edge implements EdgeInterface<T> {
      @Field(() => this.entityClass)
      node!: T;

      @Field()
      cursor!: string;
    }

    @ObjectType(`${this.entityName}Connection`, { isAbstract: true })
    class Connection implements ConnectionInterface<T> {
      @Field(() => [Edge], { nullable: true })
      edges!: Edge[];

      @Field(() => [this.entityClass], { nullable: true })
      nodes!: T[];

      @Field()
      pageInfo!: PageInfo;

      @Field(() => Int, { nullable: true })
      totalCount?: number;
    }

    const OrderField =
      this.options.orderFields.length > 0
        ? this.options.orderFields.reduce<OrderFieldType<T, P>>(
            (result, field) => ({
              ...result,
              [_.snakeCase(field).toUpperCase()]: field,
            }),
            // eslint-disable-next-line @typescript-eslint/prefer-reduce-type-parameter
            {} as any
          )
        : undefined;

    if (typeof OrderField !== "undefined") {
      registerEnumType(OrderField, {
        name: `${this.entityName}OrderField`,
      });
    }

    @InputType(`${this.entityName}Order`)
    class Order implements OrderInterface<T, P> {
      @Field(() => OrderField ?? String)
      field!: P;

      @Field(() => OrderDirection)
      direction!: OrderDirection;
    }

    @ArgsType()
    class ConnectionArgs implements ConnectionArgsInterface<T, P> {
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
