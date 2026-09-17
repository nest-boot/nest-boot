/** Builds GraphQL names while preserving the original permission values. */
export function createPermissionEnum(
  permissions: readonly string[],
): Record<string, string> {
  const values: Record<string, string> = Object.create(null);
  for (const permission of permissions) {
    const name = permission
      .replaceAll(":", "__")
      .replaceAll("-", "_")
      .toUpperCase();
    if (Object.hasOwn(values, name) && values[name] !== permission) {
      throw new Error(
        `Permission enum collision: "${values[name]}" and "${permission}" both map to "${name}"`,
      );
    }
    values[name] = permission;
  }
  return values;
}
