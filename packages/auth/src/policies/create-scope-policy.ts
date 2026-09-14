import type { PolicyCallback, PolicyDef } from "@mikro-orm/core";

import type { ScopePolicyOptions } from "../interfaces/scope-policy-options.interface.js";

/** @internal Builds the common native policy without discovery hooks. */
export function createScopePolicy(
  scope: "user" | "workspace",
  options: ScopePolicyOptions,
): PolicyDef {
  const type = options.type ?? "bigint";
  const property = options.property ?? scope;
  const command = options.command ?? "all";
  const roles = [...(options.roles ?? ["authenticated"])];

  if (!["bigint", "integer", "uuid", "text"].includes(type)) {
    throw new TypeError(`Unsupported scope policy type: ${type}`);
  }
  if (!["all", "select", "insert", "update", "delete"].includes(command)) {
    throw new TypeError(`Unsupported scope policy command: ${command}`);
  }
  if (!property.trim()) {
    throw new TypeError("Scope policy property must not be empty");
  }
  if (!roles.length || roles.some((role) => !role.trim())) {
    throw new TypeError("Scope policy roles must not be empty");
  }

  const matchesScope: PolicyCallback<Record<string, unknown>> = (columns) => {
    if (
      !Object.hasOwn(columns, property) ||
      typeof columns[property] !== "string" ||
      !columns[property]
    ) {
      throw new TypeError(
        `Scope policy requires a mapped column for property: ${property}`,
      );
    }
    const column = columns[property].replaceAll('"', '""');
    return `"${column}" = nullif(current_setting('app.${scope}', true), '')::${type}`;
  };

  return {
    ...(options.name !== undefined ? { name: options.name } : {}),
    command,
    roles,
    ...(command !== "insert" ? { using: matchesScope } : {}),
    ...(command === "all" || command === "insert" || command === "update"
      ? { check: matchesScope }
      : {}),
  };
}
