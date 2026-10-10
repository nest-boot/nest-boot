import type {
  Ability,
  AbilityBuilder,
  AbilityTuple,
  MongoQuery,
} from "@casl/ability";

import { entities } from "../entities/index.js";
import type { AbilityContext } from "../interfaces/ability-context.interface.js";
import type { AbilityRules } from "../interfaces/ability-rules.interface.js";

/**
 * Runs synchronous extensions without exposing the builder, mutable rules, or a build function.
 * @param builder - CASL builder that receives authorization rules.
 * @param context - Context used to resolve this operation.
 * @param catalog - User and workspace authorization catalogs.
 * @param catalog.user - Application user roles and permissions.
 * @param catalog.workspace - Workspace roles and permissions.
 * @param configure - Callback that configures the instance before use.
 */
export function extendAbility(
  builder: AbilityBuilder<Ability<AbilityTuple, MongoQuery>>,
  context: AbilityContext,
  catalog: { user: readonly string[]; workspace: readonly string[] },
  configure: (rules: AbilityRules) => unknown,
): void {
  const restrictions: Parameters<AbilityRules["cannot"]>[] = [];
  let active = true;
  const assertActive = () => {
    if (!active)
      throw new Error("Ability rules can only be configured synchronously");
  };
  const rules: AbilityRules = Object.freeze({
    can(
      permission: Parameters<AbilityRules["can"]>[0],
      ...rule: Parameters<AbilityRules["cannot"]>
    ) {
      assertActive();
      if (
        !permission ||
        typeof permission !== "object" ||
        (typeof permission.user === "string") ===
          (typeof permission.workspace === "string")
      )
        throw new Error(
          "Ability grants require exactly one user or workspace permission",
        );
      const scope = typeof permission.user === "string" ? "user" : "workspace";
      const name = permission.user ?? permission.workspace;
      if (typeof name !== "string")
        throw new Error("Ability grants require a permission name");
      if (!catalog[scope].includes(name))
        throw new Error(`Unknown ${scope} ability permission: ${name}`);
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
      if (
        context[
          scope === "user" ? "userPermissions" : "workspacePermissions"
        ].includes(name)
      )
        addRule(builder, copyRule(rule), false);
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

/**
 * Adds an allow or deny rule to the CASL ability builder.
 * @param builder - CASL builder that receives authorization rules.
 * @param rule - CASL rule arguments, including action, subject, fields, and conditions.
 * @param rule."0" - Action or actions matched by the rule.
 * @param rule."1" - Subject or subjects matched by the rule.
 * @param rule."2" - Field selection or conditions for the rule.
 * @param rule."3" - Conditions applied when a field selection is supplied.
 * @param inverted - Whether the rule denies access.
 */
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

/**
 * Returns independent copy of the rule's actions, subjects, fields, and conditions.
 * @param rule - Authorization rule to copy.
 * @returns Independent copy of the rule's actions, subjects, fields, and conditions.
 */
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
