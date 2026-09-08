import { headers } from "@nest-boot/request-context";
import { Inject, Injectable } from "@nestjs/common";

import { AUTH_TOKEN } from "./auth.constants.js";
import type {
  AuthAccessToken,
  AuthAccount,
  AuthAccountInfo,
  AuthAccountSelector,
  AuthProviderUserInfo,
  AuthRefreshedToken,
  AuthSocialProvider,
  AuthUser,
  ChangeAuthEmailOptions,
  ChangeAuthPasswordOptions,
  ChangeAuthPasswordResult,
  DeleteAuthUserOptions,
  DeleteAuthUserResult,
  LinkAuthSocialAccountOptions,
  LinkAuthSocialAccountResult,
  RequestPasswordResetOptions,
  RequestPasswordResetResult,
  ResetPasswordOptions,
  SendVerificationEmailOptions,
  SignInOptions,
  SignInResult,
  SignInSocialOptions,
  SignInSocialResult,
  SignUpOptions,
  SignUpResult,
  UnlinkAuthAccountOptions,
  UpdateAuthUserOptions,
} from "./interfaces/auth-service.interface.js";
import { applyAuthResponseCookies } from "./utils/apply-auth-response-cookies.util.js";

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
  constructor(@Inject(AUTH_TOKEN) auth: unknown) {
    this.auth = auth as InternalAuth;
  }

  private readonly auth: InternalAuth;

  /** Lists social and generic OAuth providers currently enabled. */
  async listSocialProviders(): Promise<AuthSocialProvider[]> {
    const context = await this.auth.$context;
    return context.socialProviders.map(({ id, name }) => ({
      id,
      name,
    }));
  }

  /** Signs up a user with an email address and password. */
  async signUp<User extends AuthUser = AuthUser>(
    options: SignUpOptions,
  ): Promise<SignUpResult<User>> {
    const result = await this.auth.api.signUpEmail({
      body: options,
      headers: headers(),
      returnHeaders: true,
    });
    applyAuthResponseCookies(result.headers);
    return result.response as SignUpResult<User>;
  }

  /** Signs in a user with an email address and password. */
  async signIn<User extends AuthUser = AuthUser>(
    options: SignInOptions,
  ): Promise<SignInResult<User>> {
    const result = await this.auth.api.signInEmail({
      body: options,
      headers: headers(),
      returnHeaders: true,
    });
    applyAuthResponseCookies(result.headers);
    return this.normalizeSignInResult<User>(result.response);
  }

  /** Starts a social or generic OAuth sign-in flow. */
  async signInSocial<User extends AuthUser = AuthUser>(
    options: SignInSocialOptions,
  ): Promise<SignInSocialResult<User>> {
    const result = await this.auth.api.signInSocial({
      body: options,
      headers: headers(),
      returnHeaders: true,
    });
    applyAuthResponseCookies(result.headers);
    return this.normalizeSignInSocialResult<User>(result.response);
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
  async verifyPassword(password: string): Promise<boolean> {
    const result = await this.auth.api.verifyPassword({
      body: { password },
      headers: headers(),
    });
    return result.status;
  }

  /** Updates the authenticated user's profile and configured custom fields. */
  async updateUser(options: UpdateAuthUserOptions): Promise<boolean> {
    const result = await this.auth.api.updateUser({
      body: options,
      headers: headers(),
      returnHeaders: true,
    });
    applyAuthResponseCookies(result.headers);
    return result.response.status;
  }

  /** Starts or completes the authenticated user's configured email-change flow. */
  async changeEmail(options: ChangeAuthEmailOptions): Promise<boolean> {
    const result = await this.auth.api.changeEmail({
      body: options,
      headers: headers(),
      returnHeaders: true,
    });
    applyAuthResponseCookies(result.headers);
    return result.response.status;
  }

  /** Changes the authenticated user's credential password. */
  async changePassword(
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
  async setPassword(newPassword: string): Promise<boolean> {
    const result = await this.auth.api.setPassword({
      body: { newPassword },
      headers: headers(),
    });
    return result.status;
  }

  /** Requests deletion of the authenticated user's account. */
  async deleteUser(
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
  async listAccounts(): Promise<AuthAccount[]> {
    return await this.auth.api.listUserAccounts({ headers: headers() });
  }

  /** Starts a social or OpenID Connect account-linking flow. */
  async linkSocialAccount(
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
  async unlinkAccount(options: UnlinkAuthAccountOptions): Promise<boolean> {
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
  async accountInfo<
    UserInfo extends AuthProviderUserInfo = AuthProviderUserInfo,
    Data extends object = Record<string, unknown>,
  >(selector: AuthAccountSelector): Promise<AuthAccountInfo<UserInfo, Data>> {
    return (await this.auth.api.accountInfo({
      query: selector,
      headers: headers(),
    })) as AuthAccountInfo<UserInfo, Data>;
  }

  private normalizeSignInResult<User extends AuthUser>(
    result: Omit<SignInResult, "url"> & { url?: string },
  ): SignInResult<User> {
    return {
      ...result,
      url: result.url ?? null,
    } as SignInResult<User>;
  }

  private normalizeSignInSocialResult<User extends AuthUser>(result: {
    redirect: boolean;
    url?: string;
    token?: string;
    user?: AuthUser;
  }): SignInSocialResult<User> {
    return {
      redirect: result.redirect,
      url: result.url ?? null,
      token: result.token ?? null,
      user: (result.user as User | undefined) ?? null,
    };
  }
}
