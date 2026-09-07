import { Reference } from '@mikro-orm/core';
import {
  type AuthAccountSelector,
  AuthService,
  type BaseSession,
  CurrentSession,
  CurrentUser,
  getUserAbility,
  getWorkspaceAbility,
  Public,
  serializeAbilityRules,
  SessionService,
} from '@nest-boot/auth';
import { Args, ID, Mutation, Query, Resolver } from '@nest-boot/graphql';
import { BadRequestException } from '@nestjs/common';

import { User } from '../user/user.entity.js';
import {
  AuthAccountSelectorInput,
  AuthChangeEmailInput,
  AuthChangePasswordInput,
  AuthDeleteUserInput,
  AuthLinkSocialAccountInput,
  AuthRequestPasswordResetInput,
  AuthResetPasswordInput,
  AuthSendVerificationEmailInput,
  AuthSignInInput,
  AuthSignInSocialInput,
  AuthSignUpInput,
  AuthUpdateUserInput,
} from './inputs/auth.input.js';
import {
  AuthAbilityRuleType,
  AuthAccessTokenType,
  AuthAccountInfoType,
  AuthAccountType,
  AuthChangePasswordResultType,
  AuthDeleteUserResultType,
  AuthLinkSocialAccountResultType,
  AuthRefreshedTokenType,
  AuthRequestPasswordResetResultType,
  AuthSessionType,
  AuthSignInResultType,
  AuthSignInSocialResultType,
  AuthSignUpResultType,
  AuthSocialProviderType,
} from './types/auth.type.js';

/** GraphQL transport for application authentication operations. */
@Resolver()
export class AuthResolver {
  /**
   * Creates the authentication resolver.
   * @param authService - Application authentication service.
   */
  constructor(
    private readonly authService: AuthService,
    private readonly sessionService: SessionService,
  ) {}

  /** Returns the currently authenticated user. */
  @Query(() => User)
  currentUser(@CurrentUser() user: User): User {
    return user;
  }

  /** Returns the social and generic OAuth providers enabled by the server. */
  @Public()
  @Query(() => [AuthSocialProviderType])
  async authSocialProviders(): Promise<AuthSocialProviderType[]> {
    return await this.authService.listSocialProviders();
  }

  /** Returns the current user's effective CASL rules in a transport-safe form. */
  @Query(() => [AuthAbilityRuleType])
  currentUserAbilityRules(): AuthAbilityRuleType[] {
    return toAbilityRuleTypes(serializeAbilityRules(getUserAbility()));
  }

  /** Returns the selected workspace's effective CASL rules. */
  @Query(() => [AuthAbilityRuleType])
  currentWorkspaceAbilityRules(): AuthAbilityRuleType[] {
    return toAbilityRuleTypes(serializeAbilityRules(getWorkspaceAbility()));
  }

  /** Returns the session represented by the current request. */
  @Query(() => AuthSessionType, { nullable: true })
  currentAuthSession(
    @CurrentSession() currentSession: BaseSession | null,
  ): AuthSessionType | null {
    return currentSession ? toAuthSessionType(currentSession, true) : null;
  }

  /** Registers a user with an email address and password. */
  @Public()
  @Mutation(() => AuthSignUpResultType)
  async authSignUp(
    @Args('input') input: AuthSignUpInput,
  ): Promise<AuthSignUpResultType> {
    return await this.authService.signUp({ ...input });
  }

  /** Signs in with an email address and password. */
  @Public()
  @Mutation(() => AuthSignInResultType)
  async authSignIn(
    @Args('input') input: AuthSignInInput,
  ): Promise<AuthSignInResultType> {
    return await this.authService.signIn(input);
  }

  /** Starts a social or generic OAuth sign-in flow. */
  @Public()
  @Mutation(() => AuthSignInSocialResultType)
  async authSignInSocial(
    @Args('input') input: AuthSignInSocialInput,
  ): Promise<AuthSignInSocialResultType> {
    return await this.authService.signInSocial({
      ...input,
      disableRedirect: true,
    });
  }

  /** Signs out and forwards the session-cookie removal header. */
  @Public()
  @Mutation(() => Boolean)
  async authSignOut(): Promise<boolean> {
    return await this.authService.signOut();
  }

  /** Sends an email-verification message. */
  @Public()
  @Mutation(() => Boolean)
  async authSendVerificationEmail(
    @Args('input') input: AuthSendVerificationEmailInput,
  ): Promise<boolean> {
    return await this.authService.sendVerificationEmail(input);
  }

  /** Requests an enumeration-safe password-reset message. */
  @Public()
  @Mutation(() => AuthRequestPasswordResetResultType)
  async authRequestPasswordReset(
    @Args('input') input: AuthRequestPasswordResetInput,
  ): Promise<AuthRequestPasswordResetResultType> {
    return await this.authService.requestPasswordReset(input);
  }

  /** Resets a password with a password-reset token. */
  @Public()
  @Mutation(() => Boolean)
  async authResetPassword(
    @Args('input') input: AuthResetPasswordInput,
  ): Promise<boolean> {
    return await this.authService.resetPassword(input);
  }

  /** Updates the authenticated user's profile. */
  @Mutation(() => Boolean)
  async authUpdateUser(
    @Args('input') input: AuthUpdateUserInput,
  ): Promise<boolean> {
    return await this.authService.updateUser({ ...input });
  }

  /** Starts or completes an authenticated email change. */
  @Mutation(() => Boolean)
  async authChangeEmail(
    @Args('input') input: AuthChangeEmailInput,
  ): Promise<boolean> {
    return await this.authService.changeEmail(input);
  }

  /** Changes the authenticated user's password. */
  @Mutation(() => AuthChangePasswordResultType)
  async authChangePassword(
    @Args('input') input: AuthChangePasswordInput,
  ): Promise<AuthChangePasswordResultType> {
    return await this.authService.changePassword(input);
  }

  /** Lists active sessions belonging to the authenticated user. */
  @Query(() => [AuthSessionType])
  async authSessions(
    @CurrentSession() currentSession: BaseSession,
  ): Promise<AuthSessionType[]> {
    const sessions = await this.sessionService.listSessions();

    return sessions.map((session) =>
      toAuthSessionType(session, session.id === currentSession.id),
    );
  }

  /** Revokes one active session owned by the authenticated user. */
  @Mutation(() => Boolean)
  async authRevokeSession(
    @Args('sessionId', { type: () => ID }) sessionId: string,
  ): Promise<boolean> {
    return await this.sessionService.revokeSession(sessionId);
  }

  /** Revokes every active session except the current session. */
  @Mutation(() => Boolean)
  async authRevokeOtherSessions(): Promise<boolean> {
    return await this.sessionService.revokeOtherSessions();
  }

  /** Revokes every active session owned by the authenticated user. */
  @Mutation(() => Boolean)
  async authRevokeSessions(): Promise<boolean> {
    return await this.sessionService.revokeSessions();
  }

  /** Adds a credential password to the authenticated account. */
  @Mutation(() => Boolean)
  async authSetPassword(
    @Args('newPassword') newPassword: string,
  ): Promise<boolean> {
    return await this.authService.setPassword(newPassword);
  }

  /** Requests deletion of the authenticated user. */
  @Mutation(() => AuthDeleteUserResultType)
  async authDeleteUser(
    @Args('input', { nullable: true }) input?: AuthDeleteUserInput,
  ): Promise<AuthDeleteUserResultType> {
    return await this.authService.deleteUser(input ?? {});
  }

  /** Lists authentication accounts linked to the current user. */
  @Query(() => [AuthAccountType])
  async authAccounts(): Promise<AuthAccountType[]> {
    return await this.authService.listAccounts();
  }

  /** Starts a social or OpenID Connect account-linking flow. */
  @Mutation(() => AuthLinkSocialAccountResultType)
  async authLinkSocialAccount(
    @Args('input') input: AuthLinkSocialAccountInput,
  ): Promise<AuthLinkSocialAccountResultType> {
    return await this.authService.linkSocialAccount({
      ...input,
      disableRedirect: true,
    });
  }

  /** Unlinks an authentication account from the current user. */
  @Mutation(() => Boolean)
  async authUnlinkAccount(
    @Args('accountId', { type: () => ID }) accountId: string,
  ): Promise<boolean> {
    return await this.authService.unlinkAccount({
      accountId,
    });
  }

  /** Returns a usable provider access token for a linked account. */
  @Query(() => AuthAccessTokenType)
  async authAccessToken(
    @Args('input') input: AuthAccountSelectorInput,
  ): Promise<AuthAccessTokenType> {
    return await this.authService.getAccessToken(toAccountSelector(input));
  }

  /** Refreshes provider credentials for a linked account. */
  @Mutation(() => AuthRefreshedTokenType)
  async authRefreshToken(
    @Args('input') input: AuthAccountSelectorInput,
  ): Promise<AuthRefreshedTokenType> {
    return await this.authService.refreshToken(toAccountSelector(input));
  }

  /** Returns provider identity and metadata for a linked account. */
  @Query(() => AuthAccountInfoType)
  async authAccountInfo(
    @Args('input') input: AuthAccountSelectorInput,
  ): Promise<AuthAccountInfoType> {
    return await this.authService.accountInfo(toAccountSelector(input));
  }
}

function toAccountSelector(
  input: AuthAccountSelectorInput,
): AuthAccountSelector {
  if (input.accountId) {
    return { accountId: input.accountId };
  }

  if (input.useAccountCookie === true) {
    return { useAccountCookie: true };
  }

  throw new BadRequestException(
    'Either accountId or useAccountCookie must be provided.',
  );
}

function toAbilityRuleTypes(
  rules: ReturnType<typeof serializeAbilityRules>,
): AuthAbilityRuleType[] {
  return rules.map((rule) => ({
    actions: Array.isArray(rule.action) ? rule.action : [rule.action],
    subjects: Array.isArray(rule.subject) ? rule.subject : [rule.subject],
    fields:
      rule.fields === undefined
        ? null
        : Array.isArray(rule.fields)
          ? rule.fields
          : [rule.fields],
    conditions: rule.conditions ?? null,
    inverted: rule.inverted ?? false,
    reason: rule.reason ?? null,
  }));
}

function toAuthSessionType(
  session: BaseSession,
  current: boolean,
): AuthSessionType {
  const impersonatedBy = session.impersonatedBy
    ? Reference.unwrapReference(session.impersonatedBy)
    : null;

  return {
    id: session.id,
    current,
    expiresAt: session.expiresAt,
    ipAddress: session.ipAddress ?? null,
    userAgent: session.userAgent ?? null,
    impersonatedById: impersonatedBy ? String(impersonatedBy.id) : null,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}
