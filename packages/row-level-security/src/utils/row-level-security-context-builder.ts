import { assertSnakeCase } from "./assert-snake-case";
import { escapeSqlLiteral } from "./escape-sql-literal";
import {
  RowLevelSecurityContextValue,
  SnakeCase,
} from "./row-level-security-context-builder.types";

export class RowLevelSecurityContextBuilder {
  private readonly ctx = new Map<string, string>();

  constructor(private readonly namespace = "app") {
    assertSnakeCase(namespace, "Row level security context namespace");
  }

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

  entries() {
    return Array.from(this.ctx.entries());
  }

  toSQL(): string {
    return /* SQL */ `SELECT ${this.entries()
      .map(([key, value]) => {
        const escapedValue = escapeSqlLiteral(value);
        return /* SQL */ `set_config('${this.namespace}.${key}', '${escapedValue}', true)`;
      })
      .join(",")};`;
  }
}
