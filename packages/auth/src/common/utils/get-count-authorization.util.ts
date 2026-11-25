import type { SubjectType } from "@casl/ability";

import { getAuthAbility } from "./get-auth-ability.util.js";

/**
 * Authorizes a count and preserves per-record permission checks when needed.
 * @template Entity - The entities being counted.
 * @param action - The matching list's read action.
 * @param subject - The class representing the authorization subject.
 * @returns A per-record assertion when the highest-priority rule is conditional.
 */
export function getCountAuthorization<Entity extends object>(
  action: string,
  subject: SubjectType & { prototype: Entity },
): ((entity: Entity) => void) | undefined {
  const ability = getAuthAbility();
  ability.authorize(action, subject);
  const [first] = ability.rulesFor(action, subject);
  if (first && !first.inverted && first.conditions === undefined) {
    return undefined;
  }
  return (entity) => {
    ability.authorize(action, entity);
  };
}
