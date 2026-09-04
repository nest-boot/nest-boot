import {
  Ability,
  type AbilityOptions,
  type AbilityTuple,
  fieldPatternMatcher,
  type MongoQuery,
  mongoQueryMatcher,
  type RawRuleFrom,
} from "@casl/ability";

/** CASL ability containing user-scoped authorization rules. */
export class UserAbility extends Ability<AbilityTuple, MongoQuery> {
  /** Keeps user and workspace abilities nominally distinct. */
  declare private readonly userAbilityBrand: never;

  /** Creates a user ability with CASL's Mongo-style condition matching. */
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
