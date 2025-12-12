import type { FilterQuery } from "@mikro-orm/core";
import { ArgsType, Field, Int } from "@nest-boot/graphql";
import { type Type } from "@nestjs/common";
import { GraphQLScalarType } from "graphql";
import { humanize, pluralize } from "inflection";

import {
  ConnectionArgsInterface,
  FieldOptions,
  OrderInterface,
} from "../interfaces";
import { FilterValue } from "./create-filter";

export function createConnectionArgs<Entity extends object>(
  entityName: string,
  fieldOptionsMap: Map<string, FieldOptions<Entity, any, any>>,
  OrderClass: Type<OrderInterface<Entity>>,
  FilterScalar: GraphQLScalarType<FilterQuery<Entity>, FilterValue>,
): Type<ConnectionArgsInterface<Entity>> {
  const humanizeAndPluralizeEntityName = pluralize(humanize(entityName, true));

  const filterableFields = [...fieldOptionsMap.values()].filter(
    (field) => field.filterable,
  );

  @ArgsType(`${entityName}ConnectionArgs`)
  class ConnectionArgs implements ConnectionArgsInterface<Entity> {
    @Field(() => String, {
      nullable: true,
      ...(filterableFields.length > 0
        ? {
            description: `Apply one or multiple filters to the query.\nSupported filter parameters:\n${filterableFields
              .map(({ field }) => `\`${field}\``)
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

    // eslint-disable-next-line @nest-boot/graphql-field-config-from-types
    @Field(() => OrderClass, {
      nullable: true,
      description: `Ordering options for the returned topics.`,
    })
    orderBy?: OrderInterface<Entity>;

    // eslint-disable-next-line @nest-boot/graphql-field-config-from-types
    @Field(() => FilterScalar, {
      nullable: true,
      description: `Filter ${humanizeAndPluralizeEntityName} using MongoDB query syntax.`,
    })
    filter?: FilterQuery<Entity>;
  }

  return ConnectionArgs;
}
