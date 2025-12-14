import { EntityClass, FilterQuery } from "@mikro-orm/core";
import type { FieldType } from "mikro-orm-filter-query-schema";
import type { ZodType } from "zod";

import { FieldOptions } from "./field-options.interface";

export interface ConnectionMetadata<Entity extends object> {
  entityClass: EntityClass<Entity>;
  fieldOptionsMap: Map<string, FieldOptions<Entity, FieldType, string>>;
  filterQuerySchema: ZodType<FilterQuery<Entity>>;
}
