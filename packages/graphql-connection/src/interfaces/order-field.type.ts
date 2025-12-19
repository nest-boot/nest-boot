import { AutoPath } from "@mikro-orm/core/typings";

/**
 * Utility type that converts dot notation to underscore notation.
 * For example: "user.profile.name" becomes "user_profile_name"
 * @internal
 */
type DotToUnderscore<S extends string> =
  S extends `${infer Prefix}.${infer Rest}`
    ? `${Prefix}_${DotToUnderscore<Rest>}`
    : S;

/**
 * The key type for order fields.
 *
 * Converts entity field paths to uppercase with underscores.
 * For example, "createdAt" becomes "CREATED_AT", and "user.name" becomes "USER_NAME".
 *
 * @typeParam T - The entity type
 */
export type OrderFieldKey<T> = Uppercase<DotToUnderscore<AutoPath<T, string>>>;

/**
 * The value type for order fields (the actual field path in the entity).
 *
 * @typeParam T - The entity type
 */
export type OrderFieldValue<T> = AutoPath<T, string>;

/**
 * A record mapping order field keys to their actual field paths.
 *
 * Used to create the GraphQL enum for sortable fields.
 *
 * @typeParam T - The entity type
 */
export type OrderFieldType<T> = Record<OrderFieldKey<T>, OrderFieldValue<T>>;
