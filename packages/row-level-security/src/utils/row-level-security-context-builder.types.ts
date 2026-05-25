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

export type ValidChar = LowercaseLetter | "_";

export type IsValidSnakeCase<S extends string> =
  S extends `${infer First}${infer Rest}`
    ? First extends ValidChar
      ? IsValidSnakeCase<Rest>
      : false
    : true;

export type SnakeCase<S extends string> = S extends ""
  ? never
  : S extends `_${string}` | `${string}_`
    ? never
    : S extends `${string}__${string}`
      ? never
      : IsValidSnakeCase<S> extends true
        ? S
        : never;

export type RowLevelSecurityContextValue =
  | string
  | number
  | boolean
  | null
  | undefined;
