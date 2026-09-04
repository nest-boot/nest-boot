import { Field, ID, InputType } from '@nest-boot/graphql';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

/** Email and password registration input. */
@InputType()
export class AuthSignUpInput {
  /** User display name. */
  @IsString()
  @Field(() => String)
  name!: string;

  /** User email address. */
  @IsEmail()
  @Field(() => String)
  email!: string;

  /** Initial account password. */
  @IsString()
  @MinLength(8)
  @Field(() => String)
  password!: string;

  /** Optional user avatar URL. */
  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  image?: string;

  /** URL used after email verification completes. */
  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  callbackURL?: string;

  /** Whether the created session should persist across browser restarts. */
  @IsOptional()
  @IsBoolean()
  @Field(() => Boolean, { nullable: true })
  rememberMe?: boolean;
}

/** Email and password sign-in input. */
@InputType()
export class AuthSignInInput {
  /** User email address. */
  @IsEmail()
  @Field(() => String)
  email!: string;

  /** Account password. */
  @IsString()
  @Field(() => String)
  password!: string;

  /** URL returned after successful authentication. */
  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  callbackURL?: string;

  /** Whether the created session should persist across browser restarts. */
  @IsOptional()
  @IsBoolean()
  @Field(() => Boolean, { nullable: true })
  rememberMe?: boolean;
}

/** Social or generic OAuth sign-in input. */
@InputType()
export class AuthSignInSocialInput {
  /** Configured provider identifier. */
  @IsString()
  @Field(() => String)
  provider!: string;

  /** URL returned after a successful provider callback. */
  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  callbackURL?: string;

  /** URL returned after a newly created user's provider callback. */
  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  newUserCallbackURL?: string;

  /** URL returned after a failed provider callback. */
  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  errorCallbackURL?: string;

  /** Additional OAuth scopes requested from the provider. */
  @IsOptional()
  @IsString({ each: true })
  @Field(() => [String], { nullable: true })
  scopes?: string[];

  /** Whether this flow may create a new user. */
  @IsOptional()
  @IsBoolean()
  @Field(() => Boolean, { nullable: true })
  requestSignUp?: boolean;

  /** Optional provider login hint. */
  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  loginHint?: string;
}

/** Email-verification request input. */
@InputType()
export class AuthSendVerificationEmailInput {
  /** Email address to verify. */
  @IsEmail()
  @Field(() => String)
  email!: string;

  /** URL used after email verification completes. */
  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  callbackURL?: string;
}

/** Password-reset request input. */
@InputType()
export class AuthRequestPasswordResetInput {
  /** Email address that owns the credential password. */
  @IsEmail()
  @Field(() => String)
  email!: string;

  /** URL that receives the password-reset token. */
  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  redirectTo?: string;
}

/** Password reset input. */
@InputType()
export class AuthResetPasswordInput {
  /** Replacement password. */
  @IsString()
  @MinLength(8)
  @Field(() => String)
  newPassword!: string;

  /** Token issued by the password-reset flow. */
  @IsString()
  @Field(() => String)
  token!: string;
}

/** Current-user profile update input. */
@InputType()
export class AuthUpdateUserInput {
  /** New user display name. */
  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  name?: string;

  /** New avatar URL, or `null` to remove the avatar. */
  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  image?: string | null;
}

/** Current-user email change input. */
@InputType()
export class AuthChangeEmailInput {
  /** New email address. */
  @IsEmail()
  @Field(() => String)
  newEmail!: string;

  /** URL used after email verification completes. */
  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  callbackURL?: string;
}

/** Current-user password change input. */
@InputType()
export class AuthChangePasswordInput {
  /** Current password used to authorize the change. */
  @IsString()
  @Field(() => String)
  currentPassword!: string;

  /** Replacement password. */
  @IsString()
  @MinLength(8)
  @Field(() => String)
  newPassword!: string;

  /** Whether other sessions should be revoked. */
  @IsOptional()
  @IsBoolean()
  @Field(() => Boolean, { nullable: true })
  revokeOtherSessions?: boolean;
}

/** Current-user deletion input. */
@InputType()
export class AuthDeleteUserInput {
  /** URL used after deletion verification completes. */
  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  callbackURL?: string;

  /** Current password when additional authorization is required. */
  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  password?: string;

  /** Account-deletion verification token. */
  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  token?: string;
}

/** Linked authentication account selector. */
@InputType()
export class AuthAccountSelectorInput {
  /** Linked account record identifier. */
  @IsOptional()
  @IsString()
  @Field(() => ID, { nullable: true })
  accountId?: string;

  /** Selects the account stored in the short-lived account cookie. */
  @IsOptional()
  @IsBoolean()
  @Field(() => Boolean, { nullable: true })
  useAccountCookie?: boolean;
}

/** Starts a social or OpenID Connect account-linking flow. */
@InputType()
export class AuthLinkSocialAccountInput {
  /** Configured provider identifier. */
  @IsString()
  @Field(() => String)
  provider!: string;

  /** URL returned to after a successful provider callback. */
  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  callbackURL?: string;

  /** URL returned to after a failed provider callback. */
  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  errorCallbackURL?: string;

  /** Additional OAuth scopes requested from the provider. */
  @IsOptional()
  @IsString({ each: true })
  @Field(() => [String], { nullable: true })
  scopes?: string[];

  /** Optional provider login hint. */
  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  loginHint?: string;
}
