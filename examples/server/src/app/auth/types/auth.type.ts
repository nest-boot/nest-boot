import { Field, ID, ObjectType } from '@nest-boot/graphql';
import { GraphQLJSONObject } from 'graphql-type-json';

/** User data returned by authentication operations. */
@ObjectType()
export class AuthUserType {
  /** User identifier. */
  @Field(() => ID)
  id!: string;

  /** User display name. */
  @Field(() => String)
  name!: string;

  /** User email address. */
  @Field(() => String)
  email!: string;

  /** Whether the email address has been verified. */
  @Field(() => Boolean)
  emailVerified!: boolean;

  /** User avatar URL. */
  @Field(() => String, { nullable: true })
  image?: string | null;

  /** User creation time. */
  @Field(() => Date)
  createdAt!: Date;

  /** User update time. */
  @Field(() => Date)
  updatedAt!: Date;
}

/** Email registration result. */
@ObjectType()
export class AuthSignUpResultType {
  /** Session token when registration creates a session. */
  @Field(() => String, { nullable: true })
  token!: string | null;

  /** Newly registered user. */
  @Field(() => AuthUserType)
  user!: AuthUserType;
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
  @Field(() => AuthUserType)
  user!: AuthUserType;
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

/** Active authentication session owned by the current user. */
@ObjectType()
export class AuthSessionType {
  /** Session identifier. */
  @Field(() => ID)
  id!: string;

  /** Opaque token used when revoking this session. */
  @Field(() => String)
  token!: string;

  /** Whether this is the session making the current request. */
  @Field(() => Boolean)
  current!: boolean;

  /** Session expiration time. */
  @Field(() => Date)
  expiresAt!: Date;

  /** Last known client IP address. */
  @Field(() => String, { nullable: true })
  ipAddress?: string | null;

  /** Last known client User-Agent value. */
  @Field(() => String, { nullable: true })
  userAgent?: string | null;

  /** Session creation time. */
  @Field(() => Date)
  createdAt!: Date;

  /** Session update time. */
  @Field(() => Date)
  updatedAt!: Date;
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

/** Linked authentication account. */
@ObjectType()
export class AuthAccountType {
  /** Local linked-account record identifier. */
  @Field(() => ID)
  id!: string;

  /** Provider-side account identifier. */
  @Field(() => ID)
  accountId!: string;

  /** Stable account issuer namespace. */
  @Field(() => String)
  issuer!: string;

  /** Authentication provider identifier. */
  @Field(() => ID)
  providerId!: string;

  /** User that owns the linked account. */
  @Field(() => ID)
  userId!: string;

  /** OAuth scopes granted to the account. */
  @Field(() => [String])
  scopes!: string[];

  /** Account creation time. */
  @Field(() => Date)
  createdAt!: Date;

  /** Account update time. */
  @Field(() => Date)
  updatedAt!: Date;
}

/** Identity fields returned by the provider account-info endpoint. */
@ObjectType()
export class AuthAccountIdentityType {
  /** Local linked-account record identifier. */
  @Field(() => ID)
  id!: string;

  /** Provider-side account identifier. */
  @Field(() => ID)
  accountId!: string;

  /** Stable account issuer namespace. */
  @Field(() => String)
  issuer!: string;

  /** Authentication provider identifier. */
  @Field(() => ID)
  providerId!: string;
}

/** Provider access token. */
@ObjectType()
export class AuthAccessTokenType {
  /** Provider access token. */
  @Field(() => String)
  accessToken!: string;

  /** Access-token expiration time. */
  @Field(() => Date, { nullable: true })
  accessTokenExpiresAt!: Date | null;

  /** OAuth scopes associated with the token. */
  @Field(() => [String])
  scopes!: string[];

  /** OpenID Connect ID token. */
  @Field(() => String, { nullable: true })
  idToken!: string | null;
}

/** Refreshed provider credentials. */
@ObjectType()
export class AuthRefreshedTokenType {
  /** Refreshed provider access token. */
  @Field(() => String, { nullable: true })
  accessToken!: string | null;

  /** Provider refresh token. */
  @Field(() => String)
  refreshToken!: string;

  /** Access-token expiration time. */
  @Field(() => Date, { nullable: true })
  accessTokenExpiresAt!: Date | null;

  /** Refresh-token expiration time. */
  @Field(() => Date, { nullable: true })
  refreshTokenExpiresAt!: Date | null;

  /** Space-delimited provider scope. */
  @Field(() => String, { nullable: true })
  scope!: string | null;

  /** OpenID Connect ID token. */
  @Field(() => String, { nullable: true })
  idToken!: string | null;

  /** Authentication provider identifier. */
  @Field(() => ID)
  providerId!: string;

  /** Local linked-account record identifier. */
  @Field(() => ID)
  accountId!: string;
}

/** Provider-side information for a linked authentication account. */
@ObjectType()
export class AuthAccountInfoType {
  /** Linked account identity. */
  @Field(() => AuthAccountIdentityType)
  account!: AuthAccountIdentityType;

  /** Provider user information. */
  @Field(() => GraphQLJSONObject)
  user!: Record<string, unknown>;

  /** Provider-specific account data. */
  @Field(() => GraphQLJSONObject)
  data!: Record<string, unknown>;
}
