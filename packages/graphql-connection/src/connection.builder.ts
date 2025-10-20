import type { EntityClass } from "@mikro-orm/core";
import {
  ArgsType,
  Field,
  InputType,
  Int,
  ObjectType,
  registerEnumType,
} from "@nest-boot/graphql";
import { type Type } from "@nestjs/common";
import { humanize, pluralize, underscore } from "inflection";

import { OrderDirection } from "./enums";
import { GRAPHQL_CONNECTION_METADATA } from "./graphql-connection.constants";
import {
  ConnectionArgsInterface,
  ConnectionInterface,
  ConnectionMetadata,
  EdgeInterface,
  FieldOptions,
  OrderFieldKey,
  OrderFieldType,
  OrderInterface,
  ReplacementFieldOptions,
  SortableFieldOptions,
} from "./interfaces";
import { PageInfo } from "./objects";

interface ConnectionBuildResult<Entity extends object> {
  Connection: Type<ConnectionInterface<Entity>>;
  ConnectionArgs: Type<ConnectionArgsInterface<Entity>>;
  Edge: Type<EdgeInterface<Entity>>;
  Order: Type<OrderInterface<Entity>>;
  OrderField?: OrderFieldType<Entity>;
}

export class ConnectionBuilder<Entity extends object> {
  private readonly entityName: string;
  private readonly fieldOptionsMap = new Map<
    string,
    FieldOptions<Entity, any, any>
  >();

  constructor(private readonly entityClass: EntityClass<Entity>) {
    this.entityName = entityClass.name;
  }

  private get filterableFields(): FieldOptions<Entity, any, any>[] {
    return [...this.fieldOptionsMap.values()].filter(
      (field) => field.filterable,
    );
  }

  private get sortableFields(): FieldOptions<Entity, any, any>[] {
    return [...this.fieldOptionsMap.values()].filter(
      (field) => (field as SortableFieldOptions)?.sortable,
    );
  }

  addField<
    Field extends string = never,
    Type extends "string" | "number" | "bigint" | "boolean" | "date" = never,
  >(options: FieldOptions<Entity, Field, Type>): this {
    this.fieldOptionsMap.set(options.field, options);
    return this;
  }

  build(): ConnectionBuildResult<Entity> {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const builder = this;

    const pluralizeEntityName = pluralize(builder.entityName);
    const humanizeEntityName = humanize(builder.entityName, true);
    const humanizeAndPluralizeAndEntityName = pluralize(
      humanize(builder.entityName, true),
    );

    @ObjectType(`${builder.entityName}Edge`, {
      description: `An auto-generated type which holds one ${builder.entityName} and a cursor during pagination.`,
    })
    class Edge implements EdgeInterface<Entity> {
      // eslint-disable-next-line @nest-boot/graphql-field-config-from-types
      @Field(() => builder.entityClass, {
        description: `The item at the end of ${builder.entityName}Edge.`,
      })
      node!: Entity;

      @Field(() => String, {
        complexity: 0,
        description: `A cursor for use in pagination.`,
      })
      cursor!: string;
    }

    @Reflect.metadata(GRAPHQL_CONNECTION_METADATA, {
      entityClass: builder.entityClass,
      fieldOptionsMap: builder.fieldOptionsMap,
    } satisfies ConnectionMetadata<Entity>)
    @ObjectType(`${builder.entityName}Connection`, {
      isAbstract: true,
      description: `An auto-generated type for paginating through multiple ${pluralizeEntityName}.`,
    })
    class Connection implements ConnectionInterface<Entity> {
      @Field(() => [Edge], { complexity: 0, description: `A list of edges.` })
      edges!: Edge[];

      @Field(() => PageInfo, {
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

    const OrderField = builder.sortableFields.reduce<OrderFieldType<Entity>>(
      (result, fieldOptions) => {
        return {
          ...result,
          [underscore(fieldOptions.field).toUpperCase()]:
            (fieldOptions as ReplacementFieldOptions<Entity>).replacement ??
            fieldOptions.field,
        };
      },

      { ID: "id" } as unknown as OrderFieldType<Entity>,
    );

    registerEnumType(OrderField, {
      name: `${builder.entityName}OrderField`,
      description: `Properties by which ${humanizeEntityName} connections can be ordered.`,
    });

    @InputType(`${builder.entityName}Order`, {
      description: `Ordering options for ${humanizeEntityName} connections`,
    })
    class Order implements OrderInterface<Entity> {
      // eslint-disable-next-line @nest-boot/graphql-field-config-from-types
      @Field(() => OrderField as object, {
        description: `The field to order ${humanizeAndPluralizeAndEntityName} by.`,
      })
      field!: OrderFieldKey<Entity>;

      @Field(() => OrderDirection, { description: `The ordering direction.` })
      direction!: OrderDirection;
    }

    @ArgsType()
    class ConnectionArgs implements ConnectionArgsInterface<Entity> {
      @Field(() => String, {
        nullable: true,
        ...(builder.filterableFields.length > 0
          ? {
              description: `Apply one or multiple filters to the query.\nSupported filter parameters:\n${builder.filterableFields
                .map(({ field }) => `\`${String(field)}\``)
                .join(", ")}`,
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

      @Field(() => String, {
        description: `Returns the elements that come after the specified cursor.`,
        nullable: true,
      })
      after?: string;

      @Field(() => String, {
        description: `Returns the elements that come before the specified cursor.`,
        nullable: true,
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
