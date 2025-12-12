import type { FilterQuery } from "@mikro-orm/core";
import { AutoPath } from "@mikro-orm/core/typings";

import { ReplacementArgs } from "./replacement-args.interface";

export interface BaseFieldOptions<
  Type extends "string" | "number" | "bigint" | "boolean" | "date" = never,
> {
  type: Type;
  field: string;
  array?: boolean;
  fulltext?: boolean;
  searchable?: boolean;
  filterable?: boolean;
}

export interface SortableFieldOptions<
  Type extends "string" | "number" | "bigint" | "boolean" | "date" = never,
> extends BaseFieldOptions<Type> {
  sortable?: boolean;
}

export interface SimpleFieldOptions<
  Entity extends object,
  Type extends "string" | "number" | "bigint" | "boolean" | "date" = never,
> extends SortableFieldOptions<Type> {
  field: Extract<keyof Entity, string>;
}

export interface ReplacementFieldOptions<
  Entity extends object,
  Type extends "string" | "number" | "bigint" | "boolean" | "date" = never,
  Field extends string = never,
> extends SortableFieldOptions<Type> {
  replacement: Extract<AutoPath<Entity, Field>, string>;
}

export interface ReplacementFunctionFieldOptions<
  Entity extends object,
  Type extends "string" | "number" | "bigint" | "boolean" | "date" = never,
> extends BaseFieldOptions<Type> {
  replacement?: (args: ReplacementArgs<Type>) => FilterQuery<Entity>;
}

export type FieldOptions<
  Entity extends object,
  Type extends "string" | "number" | "bigint" | "boolean" | "date" = never,
  Field extends string = never,
> =
  | SimpleFieldOptions<Entity, Type>
  | ReplacementFieldOptions<Entity, Type, Field>
  | ReplacementFunctionFieldOptions<Entity, Type>;
