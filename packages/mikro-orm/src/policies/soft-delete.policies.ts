import type { PolicyCallback, PolicyDef } from "@mikro-orm/core";

/** Options for the pair of native restrictive soft-delete policies. */
export interface SoftDeletePoliciesOptions {
  /** Nullable soft-delete property. Defaults to deletedAt. */
  property?: string;
}

/**
 * Creates restrictive native RLS policies for a nullable soft-delete property.
 * Supports PostgreSQL and PGlite, including custom database column names.
 *
 * Spread into the entity's `policies` alongside application-defined permissive
 * policies. These restrictions do not grant access or database privileges.
 *
 * Roles subject to RLS can only read, insert, and update non-deleted rows; they
 * cannot set `deletedAt`, restore deleted rows, or physically delete records.
 * Soft deletion and restoration require a separately authorized service path
 * using a database role permitted to bypass these restrictions.
 */
export function softDeletePolicies(
  options: SoftDeletePoliciesOptions = {},
): PolicyDef[] {
  const property = options.property ?? "deletedAt";
  if (!property.trim()) {
    throw new TypeError("Soft-delete policy property must not be empty");
  }
  const isNotDeleted: PolicyCallback<Record<string, unknown>> = (columns) => {
    if (
      !Object.hasOwn(columns, property) ||
      typeof columns[property] !== "string" ||
      !columns[property]
    ) {
      throw new TypeError(
        `Soft-delete policy requires a mapped column for property: ${property}`,
      );
    }
    const column = columns[property].replaceAll('"', '""');
    return `"${column}" is null`;
  };

  return [
    {
      type: "restrictive",
      command: "all",
      using: isNotDeleted,
      check: isNotDeleted,
    },
    {
      type: "restrictive",
      command: "delete",
      using: () => "false",
    },
  ];
}
