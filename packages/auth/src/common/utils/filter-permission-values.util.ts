/**
 * Omits retired GraphQL enum values without changing stored or effective grants.
 * @param permissions - Original permission values on the returned identity or key.
 * @param catalog - Current GraphQL enum names mapped to permission values.
 * @returns Permission values that the current GraphQL enum can serialize.
 */
export function filterPermissionValues(
  permissions: readonly string[],
  catalog: Readonly<Record<string, string>>,
): string[] {
  const allowed = new Set(Object.values(catalog));
  return permissions.filter((permission) => allowed.has(permission));
}
