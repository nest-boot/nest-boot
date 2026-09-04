import type { MongoQuery } from "@casl/ability";

/** JSON-safe CASL rule that can be transported to another process. */
export interface SerializedAbilityRule {
  /** Action or actions granted or denied by the rule. */
  action: string | string[];
  /** Subject name or names matched by the rule. */
  subject: string | string[];
  /** Optional fields constrained by the rule. */
  fields?: string | string[];
  /** Optional Mongo-style conditions constrained by the rule. */
  conditions?: MongoQuery;
  /** Whether this is an inverted (`cannot`) rule. */
  inverted?: boolean;
  /** Optional human-readable denial reason. */
  reason?: string;
}
