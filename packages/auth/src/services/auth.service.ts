import { headers, RequestContext } from "@nest-boot/request-context";
import { ForbiddenException, Inject, Injectable } from "@nestjs/common";

import { AUTH_TOKEN } from "../auth.constants.js";
import { AuthMiddleware } from "../auth.middleware.js";
import { Session } from "../entities/session.entity.js";
import { User } from "../entities/user.entity.js";
import {
  adaptBetterAuth,
  type BetterAuthAdapter,
} from "../infrastructure/better-auth-adapter.js";
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
import type { PasswordPolicy } from "../objects/password-policy.object.js";
import type { SignUpPayload } from "../objects/sign-up-payload.object.js";
import type { AuthAccountSelector } from "../types/auth-account-selector.type.js";
import { applyAuthResponseCookies } from "../utils/apply-auth-response-cookies.util.js";
import { SessionService } from "./session.service.js";
import { UserService } from "./user.service.js";

/** Application-facing user and account authentication operations. */
@Injectable()
export class AuthService {
  /**
   * Creates a new AuthService instance.
   * @param auth - Internal Better Auth instance.
   * @param authMiddleware - Middleware that populates the request identity.
   * @param userService - Service for user profiles and permissions.
   * @param sessionService - Service for session queries and revocation.
   */
  constructor(
    @Inject(AUTH_TOKEN) auth: unknown,
    private readonly authMiddleware: AuthMiddleware,
    private readonly userService: UserService,
    private readonly sessionService: SessionService,
  ) {
    this.auth = adaptBetterAuth(auth);
  }

  private readonly auth: BetterAuthAdapter;

  /**
   * Returns the public credential password policy.
   * @returns Configured minimum and maximum password lengths.
   */
  getPasswordPolicy(): PasswordPolicy {
    return this.userService.getPasswordPolicy();
  }

  /**
   * Starts impersonation and adopts its identity before returning application fields.
   * @param id - Identifier of the record to access.
   * @returns User represented by the new impersonation session.
   */
  async impersonateUser(id: string): Promise<User> {
    this.authMiddleware.assertAuthenticationCanChange();
    const result = await this.userService.impersonateUser(
      this.getCurrentUser(),
      id,
    );
    return await this.adoptSession(result.session.token);
  }

  /**
   * Restores the administrator and its abilities/RLS scope in the same request.
   * @returns Restored administrator, or null when there was no impersonation session.
   */
  async stopImpersonating(): Promise<User | null> {
    this.authMiddleware.assertAuthenticationCanChange();
    const session = RequestContext.isActive()
      ? RequestContext.get(Session)
      : null;
    if (!session) throw new ForbiddenException("A user session is required");
    const result = await this.userService.stopImpersonating(session);
    return result ? await this.adoptSession(result.session.token) : null;
  }

  private async adoptSession(token: string): Promise<User> {
    const user = await this.authMiddleware.authenticateSession(token);
    await this.sessionService.setSessionCookie(token);
    return user;
  }

  /**
   * Registers a user without exposing relations that require a session.
   * @param options - Configuration for this operation.
   * @returns Created user's identifier and optional session token.
   */
  async signUpPayload(options: SignUpOptions): Promise<SignUpPayload> {
    const result = await this.signUp(options);
    if (result.token) {
      await this.authMiddleware.authenticateSession(result.token);
    }
    return { id: result.user.id, token: result.token };
  }

  /**
   * Signs in and establishes the new identity for nested GraphQL selections.
   * @param options - Configuration for this operation.
   * @returns Sign-in response with the persisted user entity.
   */
  async signInEntity(options: SignInOptions): Promise<SignInEntityResult> {
    const result = await this.signIn(options);
    return {
      ...result,
      user: await this.resolveResultUser(result.user, result.token),
    };
  }

  /**
   * Returns a redirect payload or the authenticated application user.
   * @param options - Configuration for this operation.
   * @returns Social sign-in response with a persisted user when available.
   */
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
      return entity;
    }
    // Registration without a session must not authenticate the request. Only
    // load the exact user returned by the successful registration operation.
    return await this.authMiddleware.resolveRegisteredUser(user.id);
  }

  /**
   * Returns the current user, rejecting principals without a user identity.
   * @returns Authenticated user from the current request.
   */
  getCurrentUser(): User {
    const user = RequestContext.isActive() ? RequestContext.get(User) : null;
    if (!user) throw new ForbiddenException("A user identity is required");
    return user;
  }

  /**
   * Lists social and generic OAuth providers currently enabled.
   * @returns Provider identifiers and display names available for sign-in.
   */
  async listSocialProviders(): Promise<AuthSocialProvider[]> {
    const context = await this.auth.$context;
    return context.socialProviders.map(({ id, name }) => ({
      id,
      name,
    }));
  }

  /**
   * Signs up a user with an email address and password.
   * @param options - Configuration for this operation.
   * @returns User registration response and optional session token.
   */
  async signUp(options: SignUpOptions): Promise<SignUpResult> {
    this.authMiddleware.assertAuthenticationCanChange();
    const result = await this.auth.api.signUpEmail({
      body: options,
      headers: headers(),
      returnHeaders: true,
    });
    applyAuthResponseCookies(result.headers);
    return result.response;
  }

  /**
   * Signs in a user with an email address and password.
   * @param options - Configuration for this operation.
   * @returns Normalized password sign-in response.
   */
  async signIn(options: SignInOptions): Promise<SignInResult> {
    this.authMiddleware.assertAuthenticationCanChange();
    const result = await this.auth.api.signInEmail({
      body: options,
      headers: headers(),
      returnHeaders: true,
    });
    applyAuthResponseCookies(result.headers);
    return this.normalizeSignInResult(result.response);
  }

  /**
   * Starts a social or generic OAuth sign-in flow.
   * @param options - Configuration for this operation.
   * @returns Normalized social sign-in response.
   */
  async signInSocial(
    options: SignInSocialOptions,
  ): Promise<SignInSocialResult> {
    this.authMiddleware.assertAuthenticationCanChange();
    const result = await this.auth.api.signInSocial({
      body: options,
      headers: headers(),
      returnHeaders: true,
    });
    applyAuthResponseCookies(result.headers);
    return this.normalizeSignInSocialResult(result.response);
  }

  /**
   * Signs out the session represented by the current request context.
   * @returns Whether the current session was signed out successfully.
   */
  async signOut(): Promise<boolean> {
    this.authMiddleware.assertAuthenticationCanChange();
    const result = await this.auth.api.signOut({
      headers: headers(),
      returnHeaders: true,
    });
    if (result.response.success) this.authMiddleware.clearAuthentication();
    applyAuthResponseCookies(result.headers);
    return result.response.success;
  }

  /**
   * Sends an email-verification link to an unverified email address.
   * @param options - Configuration for this operation.
   * @returns Whether the verification email request succeeded.
   */
  async sendVerificationEmail(
    options: SendVerificationEmailOptions,
  ): Promise<boolean> {
    const result = await this.auth.api.sendVerificationEmail({ body: options });
    return result.status;
  }

  /**
   * Requests an enumeration-safe password-reset email.
   * @param options - Configuration for this operation.
   * @returns Password reset request status and message.
   */
  async requestPasswordReset(
    options: RequestPasswordResetOptions,
  ): Promise<RequestPasswordResetResult> {
    return await this.auth.api.requestPasswordReset({ body: options });
  }

  /**
   * Resets a credential password using a password-reset token.
   * @param options - Configuration for this operation.
   * @returns Whether the password was reset successfully.
   */
  async resetPassword(options: ResetPasswordOptions): Promise<boolean> {
    this.authMiddleware.assertAuthenticationCanChange();
    const result = await this.auth.api.resetPassword({ body: options });
    if (result.status) await this.authMiddleware.revalidateCurrentSession();
    return result.status;
  }

  /**
   * Verifies the authenticated user's credential password.
   * @param password - Plaintext password to verify.
   * @returns Whether password verification succeeded.
   */
  async verifyCurrentUserPassword(password: string): Promise<boolean> {
    const result = await this.auth.api.verifyPassword({
      body: { password },
      headers: headers(),
    });
    return result.status;
  }

  /**
   * Updates the authenticated user's profile and refreshes its request identity.
   * @param options - Configuration for this operation.
   * @returns Whether the profile update succeeded.
   */
  async updateCurrentUser(options: UpdateAuthUserOptions): Promise<boolean> {
    this.authMiddleware.assertAuthenticationCanChange();
    const result = await this.auth.api.updateUser({
      body: options,
      headers: headers(),
      returnHeaders: true,
    });
    if (result.response.status) await this.authMiddleware.refreshCurrentUser();
    applyAuthResponseCookies(result.headers);
    return result.response.status;
  }

  /**
   * Starts or completes the authenticated user's configured email-change flow.
   * @param options - Configuration for this operation.
   * @returns Whether the email change request succeeded.
   */
  async changeCurrentUserEmail(
    options: ChangeAuthEmailOptions,
  ): Promise<boolean> {
    this.authMiddleware.assertAuthenticationCanChange();
    const result = await this.auth.api.changeEmail({
      body: options,
      headers: headers(),
      returnHeaders: true,
    });
    // A successful response may only queue verification; reload persisted state.
    if (result.response.status) await this.authMiddleware.refreshCurrentUser();
    applyAuthResponseCookies(result.headers);
    return result.response.status;
  }

  /**
   * Changes the authenticated user's credential password.
   * @param options - Configuration for this operation.
   * @returns Replacement session token, when the password change issues one.
   */
  async changeCurrentUserPassword(
    options: ChangeAuthPasswordOptions,
  ): Promise<ChangeAuthPasswordResult> {
    if (options.revokeOtherSessions)
      this.authMiddleware.assertAuthenticationCanChange();
    const result = await this.auth.api.changePassword({
      body: options,
      headers: headers(),
      returnHeaders: true,
    });
    if (result.response.token) {
      try {
        await this.authMiddleware.authenticateSession(result.response.token);
      } catch (error) {
        // Rotation already revoked the old session; never retain its identity.
        this.authMiddleware.clearAuthentication();
        throw error;
      }
    }
    applyAuthResponseCookies(result.headers);
    return { token: result.response.token };
  }

  /**
   * Adds a credential password to an authenticated account that has none.
   * @param newPassword - New plaintext password to validate and store.
   * @returns Whether the credential password was set successfully.
   */
  async setCurrentUserPassword(newPassword: string): Promise<boolean> {
    const result = await this.auth.api.setPassword({
      body: { newPassword },
      headers: headers(),
    });
    return result.status;
  }

  /**
   * Requests deletion of the authenticated user's account.
   * @param options - Configuration for this operation.
   * @returns Account deletion status and any redirect information.
   */
  async deleteCurrentUser(
    options?: DeleteAuthUserOptions,
  ): Promise<DeleteAuthUserResult> {
    this.authMiddleware.assertAuthenticationCanChange();
    const result = await this.auth.api.deleteUser({
      body: options ?? {},
      headers: headers(),
      returnHeaders: true,
    });
    if (result.response.success && result.response.message === "User deleted") {
      this.authMiddleware.clearAuthentication();
    }
    applyAuthResponseCookies(result.headers);
    return result.response;
  }

  /**
   * Lists safe summaries of authentication accounts linked to the current user.
   * @returns Provider accounts linked to the authenticated user.
   */
  async listCurrentUserAccounts(): Promise<AuthAccount[]> {
    return await this.auth.api.listUserAccounts({ headers: headers() });
  }

  /**
   * Starts a social or OpenID Connect account-linking flow.
   * @param options - Configuration for this operation.
   * @returns Account linking response and any provider redirect URL.
   */
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

  /**
   * Unlinks an authentication account from the current user.
   * @param options - Configuration for this operation.
   * @returns Whether the provider account was unlinked successfully.
   */
  async unlinkCurrentUserAccount(
    options: UnlinkAuthAccountOptions,
  ): Promise<boolean> {
    const result = await this.auth.api.unlinkAccount({
      body: options,
      headers: headers(),
    });
    return result.status;
  }

  /**
   * Returns a usable provider access token for a linked account.
   * @param selector - Fields that identify the provider account.
   * @returns Provider access token with expiration and scope metadata.
   */
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

  /**
   * Refreshes provider credentials for a linked account.
   * @param selector - Fields that identify the provider account.
   * @returns Refreshed provider tokens and their expiration metadata.
   */
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

  /**
   * Returns provider identity and metadata for a linked account.
   * @param selector - Fields that identify the provider account.
   * @returns Information returned by the selected provider account.
   */
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
    };
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
