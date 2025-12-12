import type { EntityClass } from "@mikro-orm/core";
import { Field, ObjectType } from "@nest-boot/graphql";
import { type Type } from "@nestjs/common";

import { EdgeInterface } from "../interfaces";

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
