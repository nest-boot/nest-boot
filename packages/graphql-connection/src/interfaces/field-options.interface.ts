import type {
  FieldType,
  ReplacementCallbackFieldOptions as FilterReplacementCallbackFieldOptions,
  ReplacementFieldOptions as FilterReplacementFieldOptions,
  SimpleFieldOptions as FilterSimpleFieldOptions,
} from "mikro-orm-filter-query-schema";

export interface BaseFieldOptions {
  filterable?: boolean;
  searchable?: boolean;
}

export interface SortableFieldOptions {
  sortable?: boolean;
}

export interface SimpleFieldOptions<
  Entity extends object,
  Type extends FieldType = never,
> extends FilterSimpleFieldOptions<Entity, Type>,
    BaseFieldOptions,
    SortableFieldOptions {}

export interface ReplacementFieldOptions<
  Entity extends object,
  Type extends FieldType = never,
  Field extends string = never,
> extends FilterReplacementFieldOptions<Entity, Type, Field>,
    BaseFieldOptions,
    SortableFieldOptions {}

export interface ReplacementFunctionFieldOptions<
  Entity extends object,
  Type extends FieldType = never,
> extends FilterReplacementCallbackFieldOptions<Entity, Type>,
    BaseFieldOptions,
    SortableFieldOptions {}

export type FieldOptions<
  Entity extends object,
  Type extends FieldType = never,
  Field extends string = never,
> =
  | SimpleFieldOptions<Entity, Type>
  | ReplacementFieldOptions<Entity, Type, Field>
  | ReplacementFunctionFieldOptions<Entity, Type>;
