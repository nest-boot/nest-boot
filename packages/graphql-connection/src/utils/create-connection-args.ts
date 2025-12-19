import type { FilterQuery } from "@mikro-orm/core";
import { ArgsType, Field, Int } from "@nest-boot/graphql";
import { type Type } from "@nestjs/common";
import { GraphQLScalarType } from "graphql";
import { humanize, pluralize } from "inflection";
import type { FieldType } from "mikro-orm-filter-query-schema";

import {
  ConnectionArgsInterface,
  FieldOptions,
  OrderInterface,
} from "../interfaces";

/**
 * Creates a GraphQL Args type for connection queries.
 *
 * The generated Args type includes:
 * - `first`/`last`: Number of items to return (for forward/backward pagination)
 * - `after`/`before`: Cursor for pagination position
 * - `query`: Search query string
 * - `filter`: MongoDB-style filter query
 * - `orderBy`: Sorting options
 *
 * @typeParam Entity - The entity type being queried
 * @param entityName - The name to use for the GraphQL type
 * @param fieldOptionsMap - Map of field configurations
 * @param OrderClass - The Order input type class
 * @param FilterScalar - The Filter scalar type
 * @returns A class implementing ConnectionArgsInterface
 *
 * @internal Used by ConnectionBuilder.build()
 */
export function createConnectionArgs<Entity extends object>(
  entityName: string,
  fieldOptionsMap: Map<string, FieldOptions<Entity, FieldType, string>>,
  OrderClass: Type<OrderInterface<Entity>>,
  FilterScalar: GraphQLScalarType<FilterQuery<Entity>>,
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

    // eslint-disable-next-line @nest-boot/graphql-field-config-from-types
    @Field(() => FilterScalar, {
      nullable: true,
      description: `Filter ${humanizeAndPluralizeEntityName} using MongoDB query syntax.`,
    })
    filter?: FilterQuery<Entity>;

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
      description: `Ordering options for the returned ${humanizeAndPluralizeEntityName}.`,
    })
    orderBy?: OrderInterface<Entity>;
  }

  return ConnectionArgs;
}
