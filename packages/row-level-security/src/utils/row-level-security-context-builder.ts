import { assertSnakeCase } from "./assert-snake-case";
import { escapeSqlLiteral } from "./escape-sql-literal";
import {
  RowLevelSecurityContextValue,
  SnakeCase,
} from "./row-level-security-context-builder.types";

/** Builds SQL that writes RLS context values into PostgreSQL transaction settings. */
export class RowLevelSecurityContextBuilder {
  private readonly ctx = new Map<string, string>();

  /** Creates a builder for a PostgreSQL setting namespace. */
  constructor(private readonly namespace = "app") {
    assertSnakeCase(namespace, "Row level security context namespace");
  }

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
    return /* SQL */ `SELECT ${this.entries()
      .map(([key, value]) => {
        const escapedValue = escapeSqlLiteral(value);
        return /* SQL */ `set_config('${this.namespace}.${key}', '${escapedValue}', true)`;
      })
      .join(",")};`;
  }
}
