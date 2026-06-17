import type { FilterQuery } from "@mikro-orm/core";
import type {
  FieldType,
  ReplacementCallbackArgs,
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
   * @defaultValue true
   */
  filterable?: boolean;

  /**
   * Whether this field is included in text search queries.
   * Only applicable to string fields.
   *
   * When combined with `fulltext: "fieldPath"`, search queries use
   * `$fulltext` on the configured full-text field path.
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
  Field extends string = never,
> = FilterSimpleFieldOptions<Entity, Type, Field> &
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
  Field extends string = never,
> = FilterReplacementCallbackFieldOptions<Entity, Type, Field> &
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
  | SimpleFieldOptions<Entity, Type, Field>
  | ReplacementFieldOptions<Entity, Type, Field>
  | ReplacementFunctionFieldOptions<Entity, Type, Field>;

/**
 * Runtime field configuration stored after a field has been added.
 *
 * This intentionally avoids the public AutoPath-heavy field option types so
 * internal maps can be passed around without repeatedly expanding entity paths.
 *
 * @typeParam Entity - The entity type
 */
export type ConnectionFieldOptions<Entity extends object> = BaseFieldOptions &
  SortableFieldOptions & {
    /**
     * The field name used in connection filter and search input.
     */
    field: string;

    /**
     * The field data type.
     */
    type: FieldType;

    /**
     * Whether this field represents an array type.
     */
    array?: boolean;

    /**
     * Enables `$fulltext`; when set to a string path, maps `$fulltext` there.
     */
    fulltext?: boolean | string;

    /**
     * Enables `$prefix` for string prefix searches.
     */
    prefix?: boolean;

    /**
     * Optional field replacement path or callback.
     */
    replacement?:
      | string
      | ((args: ReplacementCallbackArgs<FieldType>) => FilterQuery<Entity>);
  };
