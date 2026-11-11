import { ApiKey } from "../../api-key/entities/api-key.entity.js";
import { SystemApiKey } from "../../api-key/entities/system-api-key.entity.js";
import { UserApiKey } from "../../api-key/entities/user-api-key.entity.js";
import { WorkspaceApiKey } from "../../api-key/entities/workspace-api-key.entity.js";

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
    entity instanceof ApiKey
      ? (entity.ownerType === "user"
          ? UserApiKey
          : entity.ownerType === "member"
            ? WorkspaceApiKey
            : SystemApiKey
        ).prototype
      : Object.getPrototypeOf(entity);
  Object.setPrototypeOf(result, prototype);
  return result;
}
