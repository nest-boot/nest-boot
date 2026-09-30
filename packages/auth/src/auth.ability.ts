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
 * Without an authenticated ability, can/cannot return false/true; other access throws.
 */
export const authAbility: AuthAbility = new Proxy(new AuthAbility(), {
  get(target, property) {
    const own = Reflect.getOwnPropertyDescriptor(target, property);
    if (typeof own?.value === "function") return own.value;
    if (!Reflect.has(target, property)) return undefined;

    if (typeof Reflect.get(target, property, target) === "function") {
      const forward = (...args: unknown[]) => {
        const ability = readRequestAbility();
        if (!ability) {
          if (property === "can") return false;
          if (property === "cannot") return true;
          throw new ForbiddenException("Permission ability is not available");
        }
        return Reflect.apply(
          Reflect.get(ability, property, ability),
          ability,
          args,
        );
      };
      // Cache only forwarding functions, never a request's ability or bound method.
      Object.defineProperty(target, property, {
        value: forward,
        configurable: true,
        writable: true,
      });
      return forward;
    }

    const ability = readRequestAbility();
    if (!ability)
      throw new ForbiddenException("Permission ability is not available");
    return Reflect.get(ability, property, ability);
  },
});

/** Reads the prepared ability only while its authenticated identity is available. @internal */
export function readRequestAbility(): AuthAbility | null {
  if (
    !RequestContext.isActive() ||
    (!RequestContext.get(User) && !getCurrentApiKey())
  )
    return null;
  return RequestContext.get(AuthAbility) ?? null;
}
