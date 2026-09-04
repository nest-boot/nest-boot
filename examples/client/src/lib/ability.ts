import { createMongoAbility, subject } from "@casl/ability";

export interface SerializedAbilityRule {
  actions: Array<string>;
  subjects: Array<string>;
  fields?: Array<string> | null;
  conditions?: Record<string, unknown> | null;
  inverted: boolean;
  reason?: string | null;
}

/** Rehydrates GraphQL ability rules into a client-side CASL ability. */
export function createAbility(rules: ReadonlyArray<SerializedAbilityRule>) {
  return createMongoAbility(
    rules.map((rule) => ({
      action: rule.actions,
      subject: rule.subjects,
      ...(rule.fields ? { fields: rule.fields } : {}),
      ...(rule.conditions ? { conditions: rule.conditions } : {}),
      ...(rule.inverted ? { inverted: true } : {}),
      ...(rule.reason ? { reason: rule.reason } : {}),
    })),
  );
}

/** Tags an immutable API result without mutating Apollo's cached object. */
export function createAbilitySubject<T extends object>(type: string, value: T) {
  return subject(type, { ...value });
}
