import type { FilterQuery } from "@mikro-orm/core";
import { AutoPath } from "@mikro-orm/core/typings";

import { ReplacementArgs } from "./replacement-args.interface";

export interface BaseFieldOptions {
  array?: boolean;
  fulltext?: boolean;
  searchable?: boolean;
  filterable?: boolean;
}

export interface SortableFieldOptions extends BaseFieldOptions {
  sortable?: boolean;
}

export interface SimpleFieldOptions<
  Entity extends object,
  Fields extends string = never,
> extends SortableFieldOptions {
  field: AutoPath<Entity, Fields>;
  sortable?: boolean;
}

export interface ReplacementFieldOptions<
  Entity extends object,
  Fields extends string = never,
> extends SortableFieldOptions {
  field: string;
  replacement: AutoPath<Entity, Fields>;
  sortable?: boolean;
}

export interface ReplacementFunctionFieldOptions<
  Entity extends object,
  Type extends "string" | "number" | "bigint" | "boolean" | "date" = never,
> extends SortableFieldOptions {
  field: string;
  type: Type;
  replacement?: (args: ReplacementArgs<Type>) => FilterQuery<Entity>;
}

export type FieldOptions<
  Entity extends object,
  Fields extends string = never,
  Type extends "string" | "number" | "bigint" | "boolean" | "date" = never,
> =
  | SimpleFieldOptions<Entity, Fields>
  | ReplacementFieldOptions<Entity, Fields>
  | ReplacementFunctionFieldOptions<Entity, Type>;
