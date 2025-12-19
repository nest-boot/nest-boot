import type {
  FieldType,
  ReplacementCallbackFieldOptions as FilterReplacementCallbackFieldOptions,
  ReplacementFieldOptions as FilterReplacementFieldOptions,
  SimpleFieldOptions as FilterSimpleFieldOptions,
} from "mikro-orm-filter-query-schema";

/**
 * Base options shared by all field types.
 */
export interface BaseFieldOptions {
  /**
   * Whether this field can be used in filter queries.
   * @default true
   */
  filterable?: boolean;

  /**
   * Whether this field is included in text search queries.
   * Only applicable to string fields.
   */
  searchable?: boolean;
}

/**
 * Options for fields that can be sorted.
 */
export interface SortableFieldOptions {
  /**
   * Whether this field can be used for ordering results.
   * When true, the field will be included in the OrderField enum.
   */
  sortable?: boolean;
}

/**
 * Options for a simple field with direct entity property mapping.
 *
 * @typeParam Entity - The entity type
 * @typeParam Type - The field type ("string", "number", "boolean", or "date")
 */
export type SimpleFieldOptions<
  Entity extends object,
  Type extends FieldType = never,
> = FilterSimpleFieldOptions<Entity, Type> &
  BaseFieldOptions &
  SortableFieldOptions;

/**
 * Options for a field with a replacement property path.
 *
 * Use this when the GraphQL field name differs from the entity property path.
 *
 * @typeParam Entity - The entity type
 * @typeParam Type - The field type
 * @typeParam Field - The GraphQL field name
 */
export type ReplacementFieldOptions<
  Entity extends object,
  Type extends FieldType = never,
  Field extends string = never,
> = FilterReplacementFieldOptions<Entity, Type, Field> &
  BaseFieldOptions &
  SortableFieldOptions;

/**
 * Options for a field with a replacement callback function.
 *
 * Use this for complex field mappings that require runtime logic.
 *
 * @typeParam Entity - The entity type
 * @typeParam Type - The field type
 */
export type ReplacementFunctionFieldOptions<
  Entity extends object,
  Type extends FieldType = never,
> = FilterReplacementCallbackFieldOptions<Entity, Type> &
  BaseFieldOptions &
  SortableFieldOptions;

/**
 * Union type of all field option types.
 *
 * This is the type used when adding fields to a ConnectionBuilder.
 *
 * @typeParam Entity - The entity type
 * @typeParam Type - The field type
 * @typeParam Field - The GraphQL field name (for replacement options)
 *
 * @example Simple field
 * ```typescript
 * const options: FieldOptions<User, "string"> = {
 *   field: "name",
 *   type: "string",
 *   filterable: true,
 *   sortable: true,
 * };
 * ```
 *
 * @example Replacement field
 * ```typescript
 * const options: FieldOptions<User, "string", "authorName"> = {
 *   field: "authorName",
 *   type: "string",
 *   replacement: "author.name",
 *   filterable: true,
 * };
 * ```
 */
export type FieldOptions<
  Entity extends object,
  Type extends FieldType = never,
  Field extends string = never,
> =
  | SimpleFieldOptions<Entity, Type>
  | ReplacementFieldOptions<Entity, Type, Field>
  | ReplacementFunctionFieldOptions<Entity, Type>;
