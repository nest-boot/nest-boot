/** Lowercase letters allowed in snake_case context keys. */
export type LowercaseLetter =
  | "a"
  | "b"
  | "c"
  | "d"
  | "e"
  | "f"
  | "g"
  | "h"
  | "i"
  | "j"
  | "k"
  | "l"
  | "m"
  | "n"
  | "o"
  | "p"
  | "q"
  | "r"
  | "s"
  | "t"
  | "u"
  | "v"
  | "w"
  | "x"
  | "y"
  | "z";

/** Characters allowed in snake_case context keys. */
export type ValidChar = LowercaseLetter | "_";

/** Compile-time predicate that checks whether a string contains only valid characters. */
export type IsValidSnakeCase<S extends string> =
  S extends `${infer First}${infer Rest}`
    ? First extends ValidChar
      ? IsValidSnakeCase<Rest>
      : false
    : true;

/** Compile-time snake_case constraint used by RLS context helpers. */
export type SnakeCase<S extends string> = S extends ""
  ? never
  : S extends `_${string}` | `${string}_`
    ? never
    : S extends `${string}__${string}`
      ? never
      : IsValidSnakeCase<S> extends true
        ? S
        : never;

/** Values that can be stored in RLS context and converted to PostgreSQL settings. */
export type RowLevelSecurityContextValue =
  | string
  | number
  | boolean
  | null
  | undefined;
