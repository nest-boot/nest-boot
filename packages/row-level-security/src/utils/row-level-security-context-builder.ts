import { assertSnakeCase } from "./assert-snake-case.js";
import { escapeSqlLiteral } from "./escape-sql-literal.js";
import {
  RowLevelSecurityContextValue,
  SnakeCase,
} from "./row-level-security-context-builder.types.js";

/** Builds SQL that writes RLS context values into PostgreSQL transaction settings. */
export class RowLevelSecurityContextBuilder {
  private readonly ctx = new Map<string, string>();
  private readonly namespace = "app";

  /** Adds a context key and value, ignoring nullish values. */
  set<S extends string>(
    key: SnakeCase<S>,
    value: RowLevelSecurityContextValue,
  ) {
    assertSnakeCase(key, "Row level security context key");

    if (value === null || value === undefined) {
      return this;
    }

    this.ctx.set(key, String(value));
    return this;
  }

  /** Returns the context entries that will be emitted to SQL. */
  entries() {
    return Array.from(this.ctx.entries());
  }

  /** Renders a `SELECT set_config(...)` statement for the collected entries. */
  toSQL(): string {
    const statements = this.entries()
      .map(([key, value]) => {
        const escapedValue = escapeSqlLiteral(value);
        return /* SQL */ `set_config('${this.namespace}.${key}', '${escapedValue}', true)`;
      })
      .join(",");

    if (!statements) {
      return "SELECT 1;";
    }

    return /* SQL */ `SELECT ${statements};`;
  }
}
