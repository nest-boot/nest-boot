import { ApiKeyEntity } from "../entities/api-key.entity.js";
import { MemberApiKey } from "../entities/member-api-key.entity.js";
import { SystemAccountApiKey } from "../entities/system-account-api-key.entity.js";
import { UserApiKey } from "../entities/user-api-key.entity.js";

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
  const result = { ...entity };
  for (const key of keys) {
    Reflect.deleteProperty(result, key);
  }
  // Keep entity prototypes for GraphQL and consumers that discriminate ownership by class.
  const prototype =
    entity instanceof ApiKeyEntity
      ? (entity.ownerType === "user"
          ? UserApiKey
          : entity.ownerType === "member"
            ? MemberApiKey
            : SystemAccountApiKey
        ).prototype
      : Object.getPrototypeOf(entity);
  Object.setPrototypeOf(result, prototype);
  return result;
}
