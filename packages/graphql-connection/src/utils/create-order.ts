import { Field, InputType, registerEnumType } from "@nest-boot/graphql";
import { type Type } from "@nestjs/common";
import { humanize, pluralize, underscore } from "inflection";
import type { FieldType } from "mikro-orm-filter-query-schema";

import { OrderDirection } from "../enums";
import {
  FieldOptions,
  OrderFieldKey,
  OrderFieldType,
  OrderInterface,
  SortableFieldOptions,
} from "../interfaces";

/**
 * The result of creating order types.
 *
 * @typeParam Entity - The entity type for ordering
 */
export interface CreateOrderResult<Entity extends object> {
  /**
   * The Order input type class.
   */
  Order: Type<OrderInterface<Entity>>;

  /**
   * The OrderField enum object mapping field keys to paths.
   */
  OrderField: OrderFieldType<Entity>;
}

/**
 * Creates GraphQL Order input type and OrderField enum.
 *
 * The Order type allows specifying:
 * - `field`: Which field to order by (from the OrderField enum)
 * - `direction`: ASC or DESC
 *
 * Only fields marked as `sortable: true` in field options are included.
 *
 * @typeParam Entity - The entity type being ordered
 * @param entityName - The name to use for the GraphQL types
 * @param fieldOptionsMap - Map of field configurations
 * @returns An object containing the Order class and OrderField enum
 *
 * @internal Used by ConnectionBuilder.build()
 */
export function createOrder<Entity extends object>(
  entityName: string,
  fieldOptionsMap: Map<string, FieldOptions<Entity, FieldType, string>>,
): CreateOrderResult<Entity> {
  const humanizeEntityName = humanize(entityName, true);
  const humanizeAndPluralizeEntityName = pluralize(humanize(entityName, true));

  const sortableFields = [...fieldOptionsMap.values()].filter(
    (field) => (field as SortableFieldOptions)?.sortable,
  );

  const OrderField = sortableFields.reduce<OrderFieldType<Entity>>(
    (result, fieldOptions) => {
      return {
        ...result,
        [underscore(fieldOptions.field).toUpperCase()]:
          (fieldOptions as { replacement?: string }).replacement ??
          fieldOptions.field,
      };
    },
    { ID: "id" } as unknown as OrderFieldType<Entity>,
  );

  registerEnumType(OrderField, {
    name: `${entityName}OrderField`,
    description: `Properties by which ${humanizeEntityName} connections can be ordered.`,
  });

  @InputType(`${entityName}Order`, {
    description: `Ordering options for ${humanizeEntityName} connections`,
  })
  class Order implements OrderInterface<Entity> {
    // eslint-disable-next-line @nest-boot/graphql-field-config-from-types
    @Field(() => OrderField as object, {
      description: `The field to order ${humanizeAndPluralizeEntityName} by.`,
    })
    field!: OrderFieldKey<Entity>;

    @Field(() => OrderDirection, { description: `The ordering direction.` })
    direction!: OrderDirection;
  }

  return { Order, OrderField };
}
