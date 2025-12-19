import type { EntityClass, FilterQuery } from "@mikro-orm/core";
import { Field, Int, ObjectType } from "@nest-boot/graphql";
import { type Type } from "@nestjs/common";
import { pluralize } from "inflection";
import type { FieldType } from "mikro-orm-filter-query-schema";
import type { ZodType } from "zod";

import { GRAPHQL_CONNECTION_METADATA } from "../graphql-connection.constants";
import {
  ConnectionInterface,
  ConnectionMetadata,
  EdgeInterface,
  FieldOptions,
} from "../interfaces";
import { PageInfo } from "../objects";

/**
 * Creates a GraphQL Connection type for cursor-based pagination.
 *
 * The generated Connection type includes:
 * - `edges`: List of edges containing nodes and cursors
 * - `pageInfo`: Pagination information (hasNextPage, hasPreviousPage, cursors)
 * - `totalCount`: Total number of items matching the query
 *
 * @typeParam Entity - The entity type for the connection
 * @param entityClass - The MikroORM entity class
 * @param entityName - The name to use for the GraphQL type
 * @param EdgeClass - The Edge type class to use for edges
 * @param fieldOptionsMap - Map of field configurations
 * @param filterQuerySchema - Zod schema for validating filter queries
 * @returns A class implementing ConnectionInterface
 *
 * @internal Used by ConnectionBuilder.build()
 */
export function createConnection<Entity extends object>(
  entityClass: EntityClass<Entity>,
  entityName: string,
  EdgeClass: Type<EdgeInterface<Entity>>,
  fieldOptionsMap: Map<string, FieldOptions<Entity, FieldType, string>>,
  filterQuerySchema: ZodType<FilterQuery<Entity>>,
): Type<ConnectionInterface<Entity>> {
  const pluralizeEntityName = pluralize(entityName);

  @Reflect.metadata(GRAPHQL_CONNECTION_METADATA, {
    entityClass,
    fieldOptionsMap,
    filterQuerySchema,
  } satisfies ConnectionMetadata<Entity>)
  @ObjectType(`${entityName}Connection`, {
    isAbstract: true,
    description: `An auto-generated type for paginating through multiple ${pluralizeEntityName}.`,
  })
  class Connection implements ConnectionInterface<Entity> {
    // eslint-disable-next-line @nest-boot/graphql-field-config-from-types
    @Field(() => [EdgeClass], {
      complexity: 0,
      description: `A list of edges.`,
    })
    edges!: EdgeInterface<Entity>[];

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

  return Connection;
}
