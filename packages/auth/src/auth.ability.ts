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

/** Checks the current request's ability on every call. */
export function can(action: string, subject: Subject, field?: string): boolean {
  const ability = getAuthAbility();
  return field === undefined
    ? ability.can(action, subject)
    : ability.can(action, subject, field);
}

/** Throws ForbiddenException unless the current request permits the action. */
export function throwUnlessCan(
  action: string,
  subject: Subject,
  field?: string,
): void {
  getAuthAbility().throwUnlessCan(action, subject, field);
}

/**
 * Returns the current request's prepared ability or throws ForbiddenException.
 * Retrieve the instance again after identity changes; do not cache it across requests.
 */
export function getAuthAbility(): AuthAbility {
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
