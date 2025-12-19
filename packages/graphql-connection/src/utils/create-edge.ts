import type { EntityClass } from "@mikro-orm/core";
import { Field, ObjectType } from "@nest-boot/graphql";
import { type Type } from "@nestjs/common";

import { EdgeInterface } from "../interfaces";

/**
 * Creates a GraphQL Edge type for a connection.
 *
 * An Edge type contains:
 * - `node`: The actual entity item
 * - `cursor`: A string cursor for pagination
 *
 * @typeParam Entity - The entity type for the edge
 * @param entityClass - The MikroORM entity class (used as the node type)
 * @param entityName - The name to use for the GraphQL type
 * @returns A class implementing EdgeInterface
 *
 * @internal Used by ConnectionBuilder.build()
 */
export function createEdge<Entity extends object>(
  entityClass: EntityClass<Entity>,
  entityName: string,
): Type<EdgeInterface<Entity>> {
  @ObjectType(`${entityName}Edge`, {
    description: `An auto-generated type which holds one ${entityName} and a cursor during pagination.`,
  })
  class Edge implements EdgeInterface<Entity> {
    // eslint-disable-next-line @nest-boot/graphql-field-config-from-types
    @Field(() => entityClass, {
      description: `The item at the end of ${entityName}Edge.`,
    })
    node!: Entity;

    @Field(() => String, {
      complexity: 0,
      description: `A cursor for use in pagination.`,
    })
    cursor!: string;
  }

  return Edge;
}
