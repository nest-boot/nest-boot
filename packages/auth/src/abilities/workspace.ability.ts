import {
  Ability,
  type AbilityOptions,
  type AbilityTuple,
  fieldPatternMatcher,
  type MongoQuery,
  mongoQueryMatcher,
  type RawRuleFrom,
} from "@casl/ability";

/** CASL ability containing workspace-scoped authorization rules. */
export class WorkspaceAbility extends Ability<AbilityTuple, MongoQuery> {
  /** Keeps workspace and user abilities nominally distinct. */
  declare private readonly workspaceAbilityBrand: never;

  /** Creates a workspace ability with CASL's Mongo-style condition matching. */
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
