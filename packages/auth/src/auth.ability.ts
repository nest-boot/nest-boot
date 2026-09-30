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
import { ForbiddenException } from "@nestjs/common";

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
  authorize(action: string, subject: Subject, field?: string): void {
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
