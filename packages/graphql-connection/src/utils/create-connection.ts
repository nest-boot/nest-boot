import type { EntityClass } from "@mikro-orm/core";
import { Field, Int, ObjectType } from "@nest-boot/graphql";
import { type Type } from "@nestjs/common";
import { pluralize } from "inflection";

import { GRAPHQL_CONNECTION_METADATA } from "../graphql-connection.constants";
import {
  ConnectionInterface,
  ConnectionMetadata,
  EdgeInterface,
  FieldOptions,
} from "../interfaces";
import { PageInfo } from "../objects";

export function createConnection<Entity extends object>(
  entityClass: EntityClass<Entity>,
  entityName: string,
  EdgeClass: Type<EdgeInterface<Entity>>,
  fieldOptionsMap: Map<string, FieldOptions<Entity, any, any>>,
): Type<ConnectionInterface<Entity>> {
  const pluralizeEntityName = pluralize(entityName);

  @Reflect.metadata(GRAPHQL_CONNECTION_METADATA, {
    entityClass,
    fieldOptionsMap,
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
