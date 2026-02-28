/** Union of all lowercase letter characters (a–z). */
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

/** Characters allowed in snake_case identifiers (lowercase letters and underscore). */
export type ValidChar = LowercaseLetter | "_";

/** Recursively validates that a string contains only valid snake_case characters. */
export type IsValidSnakeCase<S extends string> =
  S extends `${infer First}${infer Rest}`
    ? First extends ValidChar
      ? IsValidSnakeCase<Rest>
      : false
    : true;

/** Ensures a string literal is a valid snake_case identifier. */
export type SnakeCase<S extends string> = S extends ""
  ? never
  : S extends `_${string}` | `${string}_`
    ? never
    : S extends `${string}__${string}`
      ? never
      : IsValidSnakeCase<S> extends true
        ? S
        : never;

/**
 * Stores key-value pairs for PostgreSQL transaction-level auth context.
 *
 * @remarks
 * Values set here are emitted as `set_config('auth.<key>', '<value>', true)` SQL
 * statements, enabling row-level security policies to access auth state.
 */
export class AuthTransactionContext {
  /** Internal storage for transaction context key-value pairs. @internal */
  private readonly ctx = new Map<string, string>();

  /**
   * Sets a snake_case key-value pair in the transaction context.
   * @param key - Must be a valid snake_case string
   * @param value - The string value to associate with the key
   * @returns This instance for chaining
   */
  set<S extends string>(key: SnakeCase<S>, value: string) {
    if (!/^[a-z]+(_[a-z]+)*$/.test(key)) {
      throw new Error(
        `Key must only contain lowercase letters and underscores, cannot start/end with underscore, and cannot have consecutive underscores: ${key}`,
      );
    }
    this.ctx.set(key, value);
    return this;
  }

  /** Returns all stored key-value pairs as an array of `[key, value]` tuples. */
  entries() {
    return Array.from(this.ctx.entries());
  }

  /** Generates a SQL statement that sets all stored values as PostgreSQL transaction-local config variables. */
  toSQL(): string {
    return /* SQL */ `SELECT ${Array.from(this.ctx.entries())
      .map(([key, value]) => {
        const escapedValue = value.replace(/'/g, "''");
        return /* SQL */ `set_config('auth.${key}', '${escapedValue}', true)`;
      })
      .join(",")};`;
  }
}
