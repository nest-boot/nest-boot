/** Copies public entity fields without credentials or ORM identity-map state. @internal */
export function omitCredentials<Entity extends object, Key extends PropertyKey>(
  entity: Entity,
  keys: readonly Key[],
): Omit<Entity, Key> {
  const result = { ...entity };
  for (const key of keys) Reflect.deleteProperty(result, key);
  // Keep entity prototypes for GraphQL and consumers that discriminate ownership by class.
  Object.setPrototypeOf(result, Object.getPrototypeOf(entity));
  return result;
}
