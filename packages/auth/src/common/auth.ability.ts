import {
  Ability,
  type AbilityOptions,
  type AbilityTuple,
  fieldPatternMatcher,
  type MongoQuery,
  mongoQueryMatcher,
  type RawRuleFrom,
  type Subject,
  type SubjectType,
} from "@casl/ability";
import { ForbiddenException } from "@nestjs/common";

import { ApiKey } from "../api-key/entities/api-key.entity.js";
import { getApiKeyView } from "../api-key/utils/api-key-view.util.js";

/** CASL ability for the authenticated request and its selected workspace. */
export class AuthAbility extends Ability<AbilityTuple, MongoQuery> {
  /**
   * Creates an ability with CASL's Mongo-style condition matching.
   * @param rules - Authorization rules to apply.
   * @param options - Configuration for this operation.
   */
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

  /**
   * Maps shared persistence instances to their owner-specific public authorization subject.
   * @param object - Resource instance or type being classified.
   * @returns Authorization subject matching the concrete credential owner.
   */
  override detectSubjectType(object?: Subject): SubjectType {
    if (object instanceof ApiKey && object.constructor === ApiKey) {
      const view = getApiKeyView(object.ownerType);
      return super.detectSubjectType(new view(object));
    }
    return super.detectSubjectType(object);
  }

  /**
   * Throws ForbiddenException unless this ability permits the action, object, or field.
   * @param action - Permission action to check.
   * @param subject - Resource instance or type to authorize.
   * @param field - Field name to inspect.
   */
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
