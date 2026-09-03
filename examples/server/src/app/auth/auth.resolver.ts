import {
  type AuthAccountSelector,
  AuthService,
  type BaseSession,
  CurrentSession,
  CurrentUser,
  Public,
  SessionService,
  UserCan,
} from '@nest-boot/auth';
import {
  Args,
  Context,
  ID,
  Mutation,
  Query,
  Resolver,
} from '@nest-boot/graphql';
import { BadRequestException } from '@nestjs/common';
import type { Request, Response } from 'express';

import { User } from '../user/user.entity.js';
import {
  AuthAccountSelectorInput,
  AuthChangeEmailInput,
  AuthChangePasswordInput,
  AuthDeleteUserInput,
  AuthRequestPasswordResetInput,
  AuthResetPasswordInput,
  AuthSendVerificationEmailInput,
  AuthSignInInput,
  AuthSignUpInput,
  AuthUpdateUserInput,
} from './inputs/auth.input.js';
import {
  AuthAccessTokenType,
  AuthAccountInfoType,
  AuthAccountType,
  AuthChangePasswordResultType,
  AuthDeleteUserResultType,
  AuthRefreshedTokenType,
  AuthRequestPasswordResetResultType,
  AuthSessionType,
  AuthSignInResultType,
  AuthSignUpResultType,
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
  @UserCan('read', User)
  @Query(() => User)
  currentUser(@CurrentUser() user: User): User {
    return user;
  }

  /** Registers a user with an email address and password. */
  @Public()
  @Mutation(() => AuthSignUpResultType)
  async authSignUp(
    @Args('input') input: AuthSignUpInput,
    @Context('req') request: Request,
    @Context('res') response: Response,
  ): Promise<AuthSignUpResultType> {
    const result = await this.authService.signUp(
      toWebHeaders(request),
      { ...input },
      {
        returnHeaders: true,
      },
    );
    applyAuthResponseHeaders(response, result.headers);
    return result.response;
  }

  /** Signs in with an email address and password. */
  @Public()
  @Mutation(() => AuthSignInResultType)
  async authSignIn(
    @Args('input') input: AuthSignInInput,
    @Context('req') request: Request,
    @Context('res') response: Response,
  ): Promise<AuthSignInResultType> {
    const result = await this.authService.signIn(toWebHeaders(request), input, {
      returnHeaders: true,
    });
    applyAuthResponseHeaders(response, result.headers);
    return result.response;
  }

  /** Signs out and forwards the session-cookie removal header. */
  @Public()
  @Mutation(() => Boolean)
  async authSignOut(
    @Context('req') request: Request,
    @Context('res') response: Response,
  ): Promise<boolean> {
    const result = await this.authService.signOut(toWebHeaders(request), {
      returnHeaders: true,
    });
    applyAuthResponseHeaders(response, result.headers);
    return result.response;
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
    @Context('req') request: Request,
    @Context('res') response: Response,
  ): Promise<boolean> {
    const result = await this.authService.updateUser(
      toWebHeaders(request),
      { ...input },
      { returnHeaders: true },
    );
    applyAuthResponseHeaders(response, result.headers);
    return result.response;
  }

  /** Starts or completes an authenticated email change. */
  @Mutation(() => Boolean)
  async authChangeEmail(
    @Args('input') input: AuthChangeEmailInput,
    @Context('req') request: Request,
    @Context('res') response: Response,
  ): Promise<boolean> {
    const result = await this.authService.changeEmail(
      toWebHeaders(request),
      input,
      { returnHeaders: true },
    );
    applyAuthResponseHeaders(response, result.headers);
    return result.response;
  }

  /** Changes the authenticated user's password. */
  @Mutation(() => AuthChangePasswordResultType)
  async authChangePassword(
    @Args('input') input: AuthChangePasswordInput,
    @Context('req') request: Request,
    @Context('res') response: Response,
  ): Promise<AuthChangePasswordResultType> {
    const result = await this.authService.changePassword(
      toWebHeaders(request),
      input,
      { returnHeaders: true },
    );
    applyAuthResponseHeaders(response, result.headers);
    return result.response;
  }

  /** Lists active sessions belonging to the authenticated user. */
  @Query(() => [AuthSessionType])
  async authSessions(
    @Context('req') request: Request,
    @CurrentSession() currentSession: BaseSession,
  ): Promise<AuthSessionType[]> {
    const sessions = await this.sessionService.listSessions(
      toWebHeaders(request),
    );

    return sessions.map((session) => ({
      id: session.id,
      token: session.token,
      current: session.id === currentSession.id,
      expiresAt: session.expiresAt,
      ipAddress: session.ipAddress ?? null,
      userAgent: session.userAgent ?? null,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    }));
  }

  /** Revokes one active session owned by the authenticated user. */
  @Mutation(() => Boolean)
  async authRevokeSession(
    @Args('token') token: string,
    @Context('req') request: Request,
  ): Promise<boolean> {
    return await this.sessionService.revokeSession(
      toWebHeaders(request),
      token,
    );
  }

  /** Revokes every active session except the current session. */
  @Mutation(() => Boolean)
  async authRevokeOtherSessions(
    @Context('req') request: Request,
  ): Promise<boolean> {
    return await this.sessionService.revokeOtherSessions(toWebHeaders(request));
  }

  /** Revokes every active session owned by the authenticated user. */
  @Mutation(() => Boolean)
  async authRevokeSessions(@Context('req') request: Request): Promise<boolean> {
    return await this.sessionService.revokeSessions(toWebHeaders(request));
  }

  /** Adds a credential password to the authenticated account. */
  @Mutation(() => Boolean)
  async authSetPassword(
    @Args('newPassword') newPassword: string,
    @Context('req') request: Request,
  ): Promise<boolean> {
    return await this.authService.setPassword(
      toWebHeaders(request),
      newPassword,
    );
  }

  /** Requests deletion of the authenticated user. */
  @Mutation(() => AuthDeleteUserResultType)
  async authDeleteUser(
    @Context('req') request: Request,
    @Context('res') response: Response,
    @Args('input', { nullable: true }) input?: AuthDeleteUserInput,
  ): Promise<AuthDeleteUserResultType> {
    const result = await this.authService.deleteUser(
      toWebHeaders(request),
      input ?? {},
      { returnHeaders: true },
    );
    applyAuthResponseHeaders(response, result.headers);
    return result.response;
  }

  /** Lists authentication accounts linked to the current user. */
  @Query(() => [AuthAccountType])
  async authAccounts(
    @Context('req') request: Request,
  ): Promise<AuthAccountType[]> {
    return await this.authService.listAccounts(toWebHeaders(request));
  }

  /** Unlinks an authentication account from the current user. */
  @Mutation(() => Boolean)
  async authUnlinkAccount(
    @Args('accountId', { type: () => ID }) accountId: string,
    @Context('req') request: Request,
  ): Promise<boolean> {
    return await this.authService.unlinkAccount(toWebHeaders(request), {
      accountId,
    });
  }

  /** Returns a usable provider access token for a linked account. */
  @Query(() => AuthAccessTokenType)
  async authAccessToken(
    @Args('input') input: AuthAccountSelectorInput,
    @Context('req') request: Request,
  ): Promise<AuthAccessTokenType> {
    return await this.authService.getAccessToken(
      toWebHeaders(request),
      toAccountSelector(input),
    );
  }

  /** Refreshes provider credentials for a linked account. */
  @Mutation(() => AuthRefreshedTokenType)
  async authRefreshToken(
    @Args('input') input: AuthAccountSelectorInput,
    @Context('req') request: Request,
  ): Promise<AuthRefreshedTokenType> {
    return await this.authService.refreshToken(
      toWebHeaders(request),
      toAccountSelector(input),
    );
  }

  /** Returns provider identity and metadata for a linked account. */
  @Query(() => AuthAccountInfoType)
  async authAccountInfo(
    @Args('input') input: AuthAccountSelectorInput,
    @Context('req') request: Request,
  ): Promise<AuthAccountInfoType> {
    return await this.authService.accountInfo(
      toWebHeaders(request),
      toAccountSelector(input),
    );
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

function toWebHeaders(request: Request): Headers {
  const headers = new Headers();

  for (const [name, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(name, item);
      }
    } else if (value !== undefined) {
      headers.set(name, value);
    }
  }

  return headers;
}

function applyAuthResponseHeaders(response: Response, headers: Headers): void {
  const cookies = headers.getSetCookie();

  if (cookies.length > 0) {
    response.append('set-cookie', cookies);
  }
}
