/**
 * Copies public entity fields without credentials or ORM identity-map state.
 * @param entity - Entity being checked by the authorization condition.
 * @param keys - Credential property names to omit.
 * @returns Copy of the entity with the selected credential fields removed.
 * @internal
 */
export function omitCredentials<Entity extends object, Key extends PropertyKey>(
  entity: Entity,
  keys: readonly Key[],
): Omit<Entity, Key> {
  // Built-in Auth models have parameterless constructors; keep copies detached without changing prototypes.
  const Constructor = entity.constructor as new () => Entity;
  const result = Object.assign(new Constructor(), entity);
  for (const key of keys) {
    Reflect.deleteProperty(result, key);
  }
  return result;
}
