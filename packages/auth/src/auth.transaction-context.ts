type LowercaseLetter =
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

type ValidChar = LowercaseLetter | "_";

type IsValidSnakeCase<S extends string> =
  S extends `${infer First}${infer Rest}`
    ? First extends ValidChar
      ? IsValidSnakeCase<Rest>
      : false
    : true;

type SnakeCase<S extends string> = S extends ""
  ? never
  : S extends `_${string}` | `${string}_`
    ? never
    : S extends `${string}__${string}`
      ? never
      : IsValidSnakeCase<S> extends true
        ? S
        : never;

/**
 * Context for handling database transactions with authentication data.
 */
export class AuthTransactionContext {
  private readonly ctx = new Map<string, string>();

  /**
   * Sets a key-value pair in the transaction context.
   *
   * @param key - The key in snake_case format.
   * @param value - The value to store.
   * @returns The updated AuthTransactionContext instance.
   * @throws Error if the key format is invalid.
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

  /**
   * Returns an array of [key, value] pairs.
   *
   * @returns An array of entries.
   */
  entries() {
    return Array.from(this.ctx.entries());
  }

  /**
   * Generates a SQL string to set the configuration parameters in the database session.
   *
   * @returns A SQL string.
   */
  toSQL(): string {
    return /* SQL */ `SELECT ${Array.from(this.ctx.entries())
      .map(([key, value]) => {
        const escapedValue = value.replace(/'/g, "''");
        return /* SQL */ `set_config('auth.${key}', '${escapedValue}', true)`;
      })
      .join(",")};`;
  }
}
