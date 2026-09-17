import { headers, RequestContext } from "@nest-boot/request-context";
import { ForbiddenException, Inject, Injectable } from "@nestjs/common";

import { AUTH_TOKEN } from "../auth.constants.js";
import { AuthGuard } from "../auth.guard.js";
import { AuthMiddleware } from "../auth.middleware.js";
import { Session } from "../entities/session.entity.js";
import { User } from "../entities/user.entity.js";
import type { AuthAccessToken } from "../interfaces/auth-access-token.interface.js";
import type { AuthAccount } from "../interfaces/auth-account.interface.js";
import type { AuthAccountInfo } from "../interfaces/auth-account-info.interface.js";
import type { AuthProviderUserInfo } from "../interfaces/auth-provider-user-info.interface.js";
import type { AuthRefreshedToken } from "../interfaces/auth-refreshed-token.interface.js";
import type { AuthSocialProvider } from "../interfaces/auth-social-provider.interface.js";
import type { AuthUser } from "../interfaces/auth-user.interface.js";
import type { ChangeAuthEmailOptions } from "../interfaces/change-auth-email-options.interface.js";
import type { ChangeAuthPasswordOptions } from "../interfaces/change-auth-password-options.interface.js";
import type { ChangeAuthPasswordResult } from "../interfaces/change-auth-password-result.interface.js";
import type { DeleteAuthUserOptions } from "../interfaces/delete-auth-user-options.interface.js";
import type { DeleteAuthUserResult } from "../interfaces/delete-auth-user-result.interface.js";
import type { LinkAuthSocialAccountOptions } from "../interfaces/link-auth-social-account-options.interface.js";
import type { LinkAuthSocialAccountResult } from "../interfaces/link-auth-social-account-result.interface.js";
import type { RequestPasswordResetOptions } from "../interfaces/request-password-reset-options.interface.js";
import type { RequestPasswordResetResult } from "../interfaces/request-password-reset-result.interface.js";
import type { ResetPasswordOptions } from "../interfaces/reset-password-options.interface.js";
import type { SendVerificationEmailOptions } from "../interfaces/send-verification-email-options.interface.js";
import type { SignInEntityResult } from "../interfaces/sign-in-entity-result.interface.js";
import type { SignInOptions } from "../interfaces/sign-in-options.interface.js";
import type { SignInResult } from "../interfaces/sign-in-result.interface.js";
import type { SignInSocialEntityResult } from "../interfaces/sign-in-social-entity-result.interface.js";
import type { SignInSocialOptions } from "../interfaces/sign-in-social-options.interface.js";
import type { SignInSocialResult } from "../interfaces/sign-in-social-result.interface.js";
import type { SignUpOptions } from "../interfaces/sign-up-options.interface.js";
import type { SignUpResult } from "../interfaces/sign-up-result.interface.js";
import type { UnlinkAuthAccountOptions } from "../interfaces/unlink-auth-account-options.interface.js";
import type { UpdateAuthUserOptions } from "../interfaces/update-auth-user-options.interface.js";
import type { SignUpPayload } from "../objects/sign-up-payload.object.js";
import type { AuthAccountSelector } from "../types/auth-account-selector.type.js";
import { applyAuthResponseCookies } from "../utils/apply-auth-response-cookies.util.js";
import { SessionService } from "./session.service.js";
import { UserService } from "./user.service.js";

interface InternalAuthResponse<Result> {
  headers: Headers;
  response: Result;
}

interface StatusResult {
  status: boolean;
}

interface InternalAuth {
  $context: Promise<{
    socialProviders: { id: string; name: string }[];
  }>;
  api: {
    accountInfo(options: {
      query: AuthAccountSelector;
      headers: HeadersInit;
    }): Promise<AuthAccountInfo>;
    getAccessToken(options: {
      body: AuthAccountSelector;
      headers: HeadersInit;
    }): Promise<{
      accessToken: string;
      accessTokenExpiresAt?: Date;
      scopes: string[];
      idToken?: string;
    }>;
    refreshToken(options: {
      body: AuthAccountSelector;
      headers: HeadersInit;
    }): Promise<{
      accessToken?: string;
      refreshToken: string;
      accessTokenExpiresAt?: Date;
      refreshTokenExpiresAt?: Date | null;
      scope?: string | null;
      idToken?: string | null;
      providerId: string;
      accountId: string;
    }>;
    signUpEmail(options: {
      body: SignUpOptions;
      headers: HeadersInit;
      returnHeaders: true;
    }): Promise<InternalAuthResponse<SignUpResult>>;
    signInEmail(options: {
      body: SignInOptions;
      headers: HeadersInit;
      returnHeaders: true;
    }): Promise<
      InternalAuthResponse<Omit<SignInResult, "url"> & { url?: string }>
    >;
    signInSocial(options: {
      body: SignInSocialOptions;
      headers: HeadersInit;
      returnHeaders: true;
    }): Promise<
      InternalAuthResponse<{
        redirect: boolean;
        url?: string;
        token?: string;
        user?: AuthUser;
      }>
    >;
    signOut(options: {
      headers: HeadersInit;
      returnHeaders: true;
    }): Promise<InternalAuthResponse<{ success: boolean }>>;
    sendVerificationEmail(options: {
      body: SendVerificationEmailOptions;
    }): Promise<StatusResult>;
    requestPasswordReset(options: {
      body: RequestPasswordResetOptions;
    }): Promise<RequestPasswordResetResult>;
    resetPassword(options: {
      body: ResetPasswordOptions;
    }): Promise<StatusResult>;
    verifyPassword(options: {
      body: { password: string };
      headers: HeadersInit;
    }): Promise<StatusResult>;
    updateUser(options: {
      body: UpdateAuthUserOptions;
      headers: HeadersInit;
      returnHeaders: true;
    }): Promise<InternalAuthResponse<StatusResult>>;
    changeEmail(options: {
      body: ChangeAuthEmailOptions;
      headers: HeadersInit;
      returnHeaders: true;
    }): Promise<InternalAuthResponse<StatusResult>>;
    changePassword(options: {
      body: ChangeAuthPasswordOptions;
      headers: HeadersInit;
      returnHeaders: true;
    }): Promise<InternalAuthResponse<{ token: string | null }>>;
    setPassword(options: {
      body: { newPassword: string };
      headers: HeadersInit;
    }): Promise<StatusResult>;
    deleteUser(options: {
      body: DeleteAuthUserOptions;
      headers: HeadersInit;
      returnHeaders: true;
    }): Promise<InternalAuthResponse<DeleteAuthUserResult>>;
    listUserAccounts(options: { headers: HeadersInit }): Promise<AuthAccount[]>;
    linkSocialAccount(options: {
      body: LinkAuthSocialAccountOptions;
      headers: HeadersInit;
      returnHeaders: true;
    }): Promise<InternalAuthResponse<LinkAuthSocialAccountResult>>;
    unlinkAccount(options: {
      body: UnlinkAuthAccountOptions;
      headers: HeadersInit;
    }): Promise<StatusResult>;
  };
}

/** Application-facing user and account authentication operations. */
@Injectable()
export class AuthService {
  /**
   * Creates a new AuthService instance.
   * @param auth - Internal Better Auth instance.
   */
  constructor(
    @Inject(AUTH_TOKEN) auth: unknown,
    private readonly authMiddleware: AuthMiddleware,
    private readonly authGuard: AuthGuard,
    private readonly userService: UserService,
    private readonly sessionService: SessionService,
  ) {
    this.auth = auth as InternalAuth;
  }

  private readonly auth: InternalAuth;

  /** Starts impersonation and adopts its identity before returning application fields. */
  async impersonateUser(id: string): Promise<User> {
    const result = await this.userService.impersonateUser(
      this.getCurrentUser(),
      id,
    );
    return await this.adoptSession(result.session.token);
  }

  /** Restores the administrator and its abilities/RLS scope in the same request. */
  async stopImpersonating(): Promise<User | null> {
    const session = RequestContext.isActive()
      ? RequestContext.get(Session)
      : null;
    if (!session) throw new ForbiddenException("A user session is required");
    const result = await this.userService.stopImpersonating(session);
    return result ? await this.adoptSession(result.session.token) : null;
  }

  private async adoptSession(token: string): Promise<User> {
    const user = await this.authMiddleware.authenticateSession(token);
    this.authGuard.refreshAbilities();
    await this.sessionService.setSessionCookie(token);
    return user;
  }

  /** Registers a user without exposing relations that require a session. */
  async signUpPayload(options: SignUpOptions): Promise<SignUpPayload> {
    const result = await this.signUp(options);
    if (result.token) {
      await this.authMiddleware.authenticateSession(result.token);
      this.authGuard.refreshAbilities();
    }
    return { id: result.user.id, token: result.token };
  }

  /** Signs in and establishes the new identity for nested GraphQL selections. */
  async signInEntity(options: SignInOptions): Promise<SignInEntityResult> {
    const result = await this.signIn(options);
    return {
      ...result,
      user: await this.resolveResultUser(result.user, result.token),
    };
  }

  /** Returns a redirect payload or the authenticated application user. */
  async signInSocialEntity(
    options: SignInSocialOptions,
  ): Promise<SignInSocialEntityResult> {
    const result = await this.signInSocial(options);
    return {
      ...result,
      user: result.user
        ? await this.resolveResultUser(result.user, result.token)
        : null,
    };
  }

  private async resolveResultUser(
    user: AuthUser,
    token: string | null,
  ): Promise<User> {
    if (token) {
      const entity = await this.authMiddleware.authenticateSession(token);
      this.authGuard.refreshAbilities();
      return entity;
    }
    // Registration without a session must not authenticate the request. Only
    // load the exact user returned by the successful registration operation.
    return await this.authMiddleware.resolveRegisteredUser(user.id);
  }

  /** Returns the current user, rejecting principals without a user identity. */
  getCurrentUser(): User {
    const user = RequestContext.isActive() ? RequestContext.get(User) : null;
    if (!user) throw new ForbiddenException("A user identity is required");
    return user;
  }

  /** Lists social and generic OAuth providers currently enabled. */
  async listSocialProviders(): Promise<AuthSocialProvider[]> {
    const context = await this.auth.$context;
    return context.socialProviders.map(({ id, name }) => ({
      id,
      name,
    }));
  }

  /** Signs up a user with an email address and password. */
  async signUp(options: SignUpOptions): Promise<SignUpResult> {
    const result = await this.auth.api.signUpEmail({
      body: options,
      headers: headers(),
      returnHeaders: true,
    });
    applyAuthResponseCookies(result.headers);
    return result.response;
  }

  /** Signs in a user with an email address and password. */
  async signIn(options: SignInOptions): Promise<SignInResult> {
    const result = await this.auth.api.signInEmail({
      body: options,
      headers: headers(),
      returnHeaders: true,
    });
    applyAuthResponseCookies(result.headers);
    return this.normalizeSignInResult(result.response);
  }

  /** Starts a social or generic OAuth sign-in flow. */
  async signInSocial(
    options: SignInSocialOptions,
  ): Promise<SignInSocialResult> {
    const result = await this.auth.api.signInSocial({
      body: options,
      headers: headers(),
      returnHeaders: true,
    });
    applyAuthResponseCookies(result.headers);
    return this.normalizeSignInSocialResult(result.response);
  }

  /** Signs out the session represented by the current request context. */
  async signOut(): Promise<boolean> {
    const result = await this.auth.api.signOut({
      headers: headers(),
      returnHeaders: true,
    });
    applyAuthResponseCookies(result.headers);
    return result.response.success;
  }

  /** Sends an email-verification link to an unverified email address. */
  async sendVerificationEmail(
    options: SendVerificationEmailOptions,
  ): Promise<boolean> {
    const result = await this.auth.api.sendVerificationEmail({ body: options });
    return result.status;
  }

  /** Requests an enumeration-safe password-reset email. */
  async requestPasswordReset(
    options: RequestPasswordResetOptions,
  ): Promise<RequestPasswordResetResult> {
    return await this.auth.api.requestPasswordReset({ body: options });
  }

  /** Resets a credential password using a password-reset token. */
  async resetPassword(options: ResetPasswordOptions): Promise<boolean> {
    const result = await this.auth.api.resetPassword({ body: options });
    return result.status;
  }

  /** Verifies the authenticated user's credential password. */
  async verifyCurrentUserPassword(password: string): Promise<boolean> {
    const result = await this.auth.api.verifyPassword({
      body: { password },
      headers: headers(),
    });
    return result.status;
  }

  /** Updates the authenticated user's profile and configured custom fields. */
  async updateCurrentUser(options: UpdateAuthUserOptions): Promise<boolean> {
    const result = await this.auth.api.updateUser({
      body: options,
      headers: headers(),
      returnHeaders: true,
    });
    applyAuthResponseCookies(result.headers);
    return result.response.status;
  }

  /** Starts or completes the authenticated user's configured email-change flow. */
  async changeCurrentUserEmail(
    options: ChangeAuthEmailOptions,
  ): Promise<boolean> {
    const result = await this.auth.api.changeEmail({
      body: options,
      headers: headers(),
      returnHeaders: true,
    });
    applyAuthResponseCookies(result.headers);
    return result.response.status;
  }

  /** Changes the authenticated user's credential password. */
  async changeCurrentUserPassword(
    options: ChangeAuthPasswordOptions,
  ): Promise<ChangeAuthPasswordResult> {
    const result = await this.auth.api.changePassword({
      body: options,
      headers: headers(),
      returnHeaders: true,
    });
    applyAuthResponseCookies(result.headers);
    return { token: result.response.token };
  }

  /** Adds a credential password to an authenticated account that has none. */
  async setCurrentUserPassword(newPassword: string): Promise<boolean> {
    const result = await this.auth.api.setPassword({
      body: { newPassword },
      headers: headers(),
    });
    return result.status;
  }

  /** Requests deletion of the authenticated user's account. */
  async deleteCurrentUser(
    options?: DeleteAuthUserOptions,
  ): Promise<DeleteAuthUserResult> {
    const result = await this.auth.api.deleteUser({
      body: options ?? {},
      headers: headers(),
      returnHeaders: true,
    });
    applyAuthResponseCookies(result.headers);
    return result.response;
  }

  /** Lists safe summaries of authentication accounts linked to the current user. */
  async listCurrentUserAccounts(): Promise<AuthAccount[]> {
    return await this.auth.api.listUserAccounts({ headers: headers() });
  }

  /** Starts a social or OpenID Connect account-linking flow. */
  async linkCurrentUserAccount(
    options: LinkAuthSocialAccountOptions,
  ): Promise<LinkAuthSocialAccountResult> {
    const result = await this.auth.api.linkSocialAccount({
      body: options,
      headers: headers(),
      returnHeaders: true,
    });
    applyAuthResponseCookies(result.headers);
    return result.response;
  }

  /** Unlinks an authentication account from the current user. */
  async unlinkCurrentUserAccount(
    options: UnlinkAuthAccountOptions,
  ): Promise<boolean> {
    const result = await this.auth.api.unlinkAccount({
      body: options,
      headers: headers(),
    });
    return result.status;
  }

  /** Returns a usable provider access token for a linked account. */
  async getAccessToken(
    selector: AuthAccountSelector,
  ): Promise<AuthAccessToken> {
    const result = await this.auth.api.getAccessToken({
      body: selector,
      headers: headers(),
    });

    return {
      accessToken: result.accessToken,
      accessTokenExpiresAt: result.accessTokenExpiresAt ?? null,
      scopes: result.scopes,
      idToken: result.idToken ?? null,
    };
  }

  /** Refreshes provider credentials for a linked account. */
  async refreshToken(
    selector: AuthAccountSelector,
  ): Promise<AuthRefreshedToken> {
    const result = await this.auth.api.refreshToken({
      body: selector,
      headers: headers(),
    });

    return {
      accessToken: result.accessToken ?? null,
      refreshToken: result.refreshToken,
      accessTokenExpiresAt: result.accessTokenExpiresAt ?? null,
      refreshTokenExpiresAt: result.refreshTokenExpiresAt ?? null,
      scope: result.scope ?? null,
      idToken: result.idToken ?? null,
      providerId: result.providerId,
      accountId: result.accountId,
    };
  }

  /** Returns provider identity and metadata for a linked account. */
  async getAccountInfo<
    UserInfo extends AuthProviderUserInfo = AuthProviderUserInfo,
    Data extends object = Record<string, unknown>,
  >(selector: AuthAccountSelector): Promise<AuthAccountInfo<UserInfo, Data>> {
    return (await this.auth.api.accountInfo({
      query: selector,
      headers: headers(),
    })) as AuthAccountInfo<UserInfo, Data>;
  }

  private normalizeSignInResult(
    result: Omit<SignInResult, "url"> & { url?: string },
  ): SignInResult {
    return {
      ...result,
      url: result.url ?? null,
    } as SignInResult;
  }

  private normalizeSignInSocialResult(result: {
    redirect: boolean;
    url?: string;
    token?: string;
    user?: AuthUser;
  }): SignInSocialResult {
    return {
      redirect: result.redirect,
      url: result.url ?? null,
      token: result.token ?? null,
      user: result.user ?? null,
    };
  }
}
