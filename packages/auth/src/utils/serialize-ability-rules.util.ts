import type { AnyAbility } from "@casl/ability";

import type { SerializedAbilityRule } from "../interfaces/serialized-ability-rule.interface.js";

/**
 * Converts CASL rules with class subjects into JSON-safe subject names.
 * @param ability - Ability used to evaluate permissions.
 * @returns Authorization rules with serializable subject names.
 */
export function serializeAbilityRules(
  ability: AnyAbility,
): SerializedAbilityRule[] {
  return ability.rules.map((rule) => ({
    action: rule.action,
    subject: serializeSubject(rule.subject),
    ...(rule.fields === undefined ? {} : { fields: rule.fields }),
    ...(rule.conditions === undefined ? {} : { conditions: rule.conditions }),
    ...(rule.inverted === undefined ? {} : { inverted: rule.inverted }),
    ...(rule.reason === undefined ? {} : { reason: rule.reason }),
  }));
}

/**
 * Returns one subject name or an array of subject names.
 * @param subject - Resource instance or type to authorize.
 * @returns One subject name or an array of subject names.
 */
function serializeSubject(subject: unknown): SerializedAbilityRule["subject"] {
  if (Array.isArray(subject))
    return [...new Set(subject.map(serializeSingleSubject))];
  return serializeSingleSubject(subject);
}

/**
 * Returns name of the subject class or string subject.
 * @param subject - Resource instance or type to authorize.
 * @returns Name of the subject class or string subject.
 */
function serializeSingleSubject(subject: unknown): string {
  if (typeof subject === "string") return subject;
  if (typeof subject === "function" && subject.name) return subject.name;

  throw new TypeError("CASL rule subject must be a string or named class");
}
