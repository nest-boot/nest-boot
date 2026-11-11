import { Field, ObjectType } from "@nest-boot/graphql";
import { GraphQLJSONObject } from "graphql-type-json";

/** JSON-safe CASL rule exposed to authenticated clients. */
@ObjectType()
export class AuthAbilityRuleType {
  /** Action names matched by the rule. */
  @Field(() => [String])
  actions!: string[];

  /** Subject names matched by the rule. */
  @Field(() => [String])
  subjects!: string[];

  /** Optional fields constrained by the rule. */
  @Field(() => [String], { nullable: true })
  fields!: string[] | null;

  /** Optional Mongo-style conditions constrained by the rule. */
  @Field(() => GraphQLJSONObject, { nullable: true })
  conditions!: Record<string, unknown> | null;

  /** Whether this is an inverted (`cannot`) rule. */
  @Field(() => Boolean)
  inverted!: boolean;

  /** Optional human-readable denial reason. */
  @Field(() => String, { nullable: true })
  reason!: string | null;
}
