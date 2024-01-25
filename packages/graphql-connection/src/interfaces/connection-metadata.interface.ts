import { EntityClass } from "@mikro-orm/core";

import { FieldOptions } from "./field-options.interface";

export interface ConnectionMetadata<Entity extends object> {
  entityClass: EntityClass<Entity>;
  fieldOptionsMap: Map<string, FieldOptions<Entity, any, any>>;
}
