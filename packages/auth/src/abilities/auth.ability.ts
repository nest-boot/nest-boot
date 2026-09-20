import {
  Ability,
  type AbilityOptions,
  type AbilityTuple,
  fieldPatternMatcher,
  type MongoQuery,
  mongoQueryMatcher,
  type RawRuleFrom,
} from "@casl/ability";

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
}
