/** Preserve stored grants when only the displayed metadata changes. */
export function getApiKeyUpdateInput<Permission extends string>(
  current: { name: string; permissions: ReadonlyArray<Permission> },
  input: { name: string; permissions: ReadonlyArray<Permission> },
): { name?: string; permissions?: Array<Permission> } {
  const permissionsChanged =
    current.permissions.length !== input.permissions.length ||
    input.permissions.some(
      (permission) => !current.permissions.includes(permission),
    );
  return {
    ...(input.name !== current.name && { name: input.name }),
    ...(permissionsChanged && { permissions: [...input.permissions] }),
  };
}
