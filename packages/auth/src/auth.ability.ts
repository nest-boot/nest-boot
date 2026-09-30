import {
  Ability,
  type AbilityOptions,
  type AbilityTuple,
  fieldPatternMatcher,
  type MongoQuery,
  mongoQueryMatcher,
  type RawRuleFrom,
  type Subject,
} from "@casl/ability";
import { RequestContext } from "@nest-boot/request-context";
import { ForbiddenException } from "@nestjs/common";

import { User } from "./entities/user.entity.js";
import { getCurrentApiKey } from "./utils/get-current-api-key.util.js";

/** CASL ability for the authenticated request and its selected workspace. */
export class AuthAbility extends Ability<AbilityTuple, MongoQuery> {
  /** Creates an ability with CASL's Mongo-style condition matching. */
  constructor(
    rules: RawRuleFrom<AbilityTuple, MongoQuery>[] = [],
    options: AbilityOptions<AbilityTuple, MongoQuery> = {},
  ) {
    super(rules, {
      conditionsMatcher: mongoQueryMatcher,
      fieldMatcher: fieldPatternMatcher,
      ...options,
    });
  }

  /** Throws ForbiddenException unless this ability permits the action, object, or field. */
  throwUnlessCan(action: string, subject: Subject, field?: string): void {
    const allowed =
      field === undefined
        ? this.can(action, subject)
        : this.can(action, subject, field);
    if (!allowed) {
      throw new ForbiddenException(
        `You are not allowed to ${action} this resource`,
      );
    }
  }
}

/**
 * Forwards ability access to the authenticated request, including after identity changes.
 * Methods resolve their receiver when called, so destructuring never captures a request.
 * Access requires an authenticated ability; otherwise ForbiddenException is thrown.
 */
export const authAbility: AuthAbility = new Proxy(new AuthAbility(), {
  get(target, property) {
    // Object introspection is independent of the authenticated request.
    if (Object.hasOwn(Object.prototype, property))
      return Reflect.get(target, property, target);

    const own = Reflect.getOwnPropertyDescriptor(target, property);
    if (typeof own?.value === "function") return own.value;
    if (!Reflect.has(target, property)) return undefined;

    if (typeof Reflect.get(target, property, target) === "function") {
      const forward = (...args: unknown[]) => {
        const ability = getAuthAbility();
        const result = Reflect.apply(
          Reflect.get(ability, property, ability),
          ability,
          args,
        );
        // Fluent methods must not expose a receiver that outlives its identity.
        return result === ability ? authAbility : result;
      };
      // Cache only forwarding functions, never a request's ability or bound method.
      Object.defineProperty(target, property, {
        value: forward,
        configurable: true,
        writable: true,
      });
      return forward;
    }

    const ability = getAuthAbility();
    return Reflect.get(ability, property, ability);
  },
});

/** Reads the prepared ability only while its authenticated identity is available. */
function getAuthAbility(): AuthAbility {
  if (
    !RequestContext.isActive() ||
    (!RequestContext.get(User) && !getCurrentApiKey())
  )
    throw new ForbiddenException("Permission ability is not available");
  const ability = RequestContext.get(AuthAbility);
  if (!ability)
    throw new ForbiddenException("Permission ability is not available");
  return ability;
}
