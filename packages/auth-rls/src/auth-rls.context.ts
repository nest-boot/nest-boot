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

export class AuthRlsContext {
  private readonly ctx = new Map<string, string>();

  set<S extends string>(key: SnakeCase<S>, value: string) {
    if (!/^[a-z]+(_[a-z]+)*$/.test(key)) {
      throw new Error(
        `Key must only contain lowercase letters and underscores, cannot start/end with underscore, and cannot have consecutive underscores: ${key}`,
      );
    }
    this.ctx.set(key, value);
    return this;
  }

  entries() {
    return Array.from(this.ctx.entries());
  }

  toSQL(): string {
    return /* SQL */ `SELECT ${Array.from(this.ctx.entries())
      .map(([key, value]) => {
        const escapedValue = value.replace(/'/g, "''");
        return /* SQL */ `set_config('auth.${key}', '${escapedValue}', true)`;
      })
      .join(",")};`;
  }
}
