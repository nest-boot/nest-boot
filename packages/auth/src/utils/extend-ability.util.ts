import type {
  Ability,
  AbilityBuilder,
  AbilityTuple,
  MongoQuery,
} from "@casl/ability";

import { entities } from "../entities/index.js";
import type { AbilityRules } from "../interfaces/ability-rules.interface.js";

/** Runs synchronous extensions without exposing the builder, mutable rules, or a build function. */
export function extendAbility(
  builder: AbilityBuilder<Ability<AbilityTuple, MongoQuery>>,
  permissions: readonly string[],
  catalog: readonly string[],
  configure: (rules: AbilityRules) => unknown,
): void {
  const granted = new Set(permissions);
  const known = new Set(catalog);
  const restrictions: Parameters<AbilityRules["cannot"]>[] = [];
  let active = true;
  const assertActive = () => {
    if (!active)
      throw new Error("Ability rules can only be configured synchronously");
  };
  const rules: AbilityRules = Object.freeze({
    can(permission: string, ...rule: Parameters<AbilityRules["cannot"]>) {
      assertActive();
      if (!known.has(permission))
        throw new Error(`Unknown ability permission: ${permission}`);
      const subjects = Array.isArray(rule[1]) ? rule[1] : [rule[1]];
      if (
        subjects.some(
          (target) =>
            target === "all" ||
            entities.some((entity) =>
              typeof target === "string"
                ? target === entity.name
                : target === entity ||
                  target.name === entity.name ||
                  ("modelName" in target && target.modelName === entity.name) ||
                  target.prototype instanceof entity,
            ),
        )
      )
        throw new Error(
          "Custom grants cannot target built-in auth subjects or all",
        );
      if (granted.has(permission)) addRule(builder, copyRule(rule), false);
    },
    cannot(...rule: Parameters<AbilityRules["cannot"]>) {
      assertActive();
      restrictions.push(copyRule(rule));
    },
  });
  try {
    if (configure(rules) !== undefined)
      throw new Error(
        "buildAbility must not return a value; auth builds the ability",
      );
    // Restrictions always win, regardless of callback declaration order.
    for (const rule of restrictions) addRule(builder, rule, true);
  } finally {
    active = false;
  }
}

function addRule(
  builder: AbilityBuilder<Ability<AbilityTuple, MongoQuery>>,
  [action, subject, fieldsOrConditions, conditions]: Parameters<
    AbilityRules["cannot"]
  >,
  inverted: boolean,
): void {
  const add = inverted ? builder.cannot : builder.can;
  if (
    typeof fieldsOrConditions === "string" ||
    Array.isArray(fieldsOrConditions)
  ) {
    add(action, subject, fieldsOrConditions, conditions);
  } else {
    add(action, subject, fieldsOrConditions);
  }
}

function copyRule(
  rule: Parameters<AbilityRules["cannot"]>,
): Parameters<AbilityRules["cannot"]> {
  return rule.map((value, index) =>
    index < 2
      ? Array.isArray(value)
        ? [...value]
        : value
      : structuredClone(value),
  ) as Parameters<AbilityRules["cannot"]>;
}
