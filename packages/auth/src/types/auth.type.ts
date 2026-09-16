import { Field, ID, ObjectType } from "@nest-boot/graphql";
import { GraphQLJSONObject } from "graphql-type-json";

import { User } from "../entities/user.entity.js";

/** Email registration result. */
@ObjectType()
export class AuthSignUpResultType {
  /** Session token when registration creates a session. */
  @Field(() => String, { nullable: true })
  token!: string | null;

  /** Newly registered user. */

  @Field(() => User)
  user!: User;
}

/** Email sign-in result. */
@ObjectType()
export class AuthSignInResultType {
  /** Whether the caller should redirect. */
  @Field(() => Boolean)
  redirect!: boolean;

  /** Created session token. */
  @Field(() => String)
  token!: string;

  /** Optional redirect target. */
  @Field(() => String, { nullable: true })
  url!: string | null;

  /** Authenticated user. */

  @Field(() => User)
  user!: User;
}

/** Social or generic OAuth provider enabled by the server. */
@ObjectType()
export class AuthSocialProviderType {
  /** Stable provider identifier. */
  @Field(() => ID)
  id!: string;

  /** Human-readable provider name. */
  @Field(() => String)
  name!: string;
}

/** Social or generic OAuth sign-in result. */
@ObjectType()
export class AuthSignInSocialResultType {
  /** Whether the browser should navigate to the provider URL. */
  @Field(() => Boolean)
  redirect!: boolean;

  /** Provider authorization URL for redirect flows. */
  @Field(() => String, { nullable: true })
  url!: string | null;

  /** Session token returned by direct token flows. */
  @Field(() => String, { nullable: true })
  token!: string | null;

  /** Authenticated user returned by direct token flows. */

  @Field(() => User, { nullable: true })
  user!: User | null;
}

/** Password-reset request result. */
@ObjectType()
export class AuthRequestPasswordResetResultType {
  /** Whether the request was accepted. */
  @Field(() => Boolean)
  status!: boolean;

  /** Enumeration-safe result message. */
  @Field(() => String)
  message!: string;
}

/** Password change result. */
@ObjectType()
export class AuthChangePasswordResultType {
  /** Replacement session token when other sessions were revoked. */
  @Field(() => String, { nullable: true })
  token!: string | null;
}

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

/** User deletion result. */
@ObjectType()
export class AuthDeleteUserResultType {
  /** Account-deletion result message. */
  @Field(() => String)
  message!: string;

  /** Whether the deletion request was accepted. */
  @Field(() => Boolean)
  success!: boolean;
}

/** Provider authorization target returned when linking an account. */
@ObjectType()
export class AuthLinkSocialAccountResultType {
  /** Provider authorization URL. */
  @Field(() => String)
  url!: string;

  /** Whether the browser should navigate to the provider URL. */
  @Field(() => Boolean)
  redirect!: boolean;
}
