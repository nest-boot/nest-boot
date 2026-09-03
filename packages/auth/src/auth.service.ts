import { Inject, Injectable } from "@nestjs/common";

import { AUTH_TOKEN } from "./auth.constants.js";
import type {
  AuthAccessToken,
  AuthAccount,
  AuthAccountInfo,
  AuthAccountSelector,
  AuthProviderUserInfo,
  AuthRefreshedToken,
  AuthServiceResponse,
  AuthServiceResponseOptions,
  AuthUser,
  ChangeAuthEmailOptions,
  ChangeAuthPasswordOptions,
  ChangeAuthPasswordResult,
  DeleteAuthUserOptions,
  DeleteAuthUserResult,
  RequestPasswordResetOptions,
  RequestPasswordResetResult,
  ResetPasswordOptions,
  SendVerificationEmailOptions,
  SignInOptions,
  SignInResult,
  SignUpOptions,
  SignUpResult,
  UnlinkAuthAccountOptions,
  UpdateAuthUserOptions,
} from "./interfaces/auth-service.interface.js";

interface StatusResult {
  status: boolean;
}

interface InternalAuth {
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
    }): Promise<SignUpResult>;
    signUpEmail(options: {
      body: SignUpOptions;
      headers: HeadersInit;
      returnHeaders: true;
    }): Promise<AuthServiceResponse<SignUpResult>>;
    signInEmail(options: {
      body: SignInOptions;
      headers: HeadersInit;
    }): Promise<Omit<SignInResult, "url"> & { url?: string }>;
    signInEmail(options: {
      body: SignInOptions;
      headers: HeadersInit;
      returnHeaders: true;
    }): Promise<
      AuthServiceResponse<Omit<SignInResult, "url"> & { url?: string }>
    >;
    signOut(options: { headers: HeadersInit }): Promise<{ success: boolean }>;
    signOut(options: {
      headers: HeadersInit;
      returnHeaders: true;
    }): Promise<AuthServiceResponse<{ success: boolean }>>;
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
    }): Promise<StatusResult>;
    updateUser(options: {
      body: UpdateAuthUserOptions;
      headers: HeadersInit;
      returnHeaders: true;
    }): Promise<AuthServiceResponse<StatusResult>>;
    changeEmail(options: {
      body: ChangeAuthEmailOptions;
      headers: HeadersInit;
    }): Promise<StatusResult>;
    changeEmail(options: {
      body: ChangeAuthEmailOptions;
      headers: HeadersInit;
      returnHeaders: true;
    }): Promise<AuthServiceResponse<StatusResult>>;
    changePassword(options: {
      body: ChangeAuthPasswordOptions;
      headers: HeadersInit;
    }): Promise<{ token: string | null }>;
    changePassword(options: {
      body: ChangeAuthPasswordOptions;
      headers: HeadersInit;
      returnHeaders: true;
    }): Promise<AuthServiceResponse<{ token: string | null }>>;
    setPassword(options: {
      body: { newPassword: string };
      headers: HeadersInit;
    }): Promise<StatusResult>;
    deleteUser(options: {
      body: DeleteAuthUserOptions;
      headers: HeadersInit;
    }): Promise<DeleteAuthUserResult>;
    deleteUser(options: {
      body: DeleteAuthUserOptions;
      headers: HeadersInit;
      returnHeaders: true;
    }): Promise<AuthServiceResponse<DeleteAuthUserResult>>;
    listUserAccounts(options: { headers: HeadersInit }): Promise<AuthAccount[]>;
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

  /** Signs up a user with an email address and password. */
  async signUp<User extends AuthUser = AuthUser>(
    headers: HeadersInit,
    options: SignUpOptions,
    responseOptions: AuthServiceResponseOptions,
  ): Promise<AuthServiceResponse<SignUpResult<User>>>;
  async signUp<User extends AuthUser = AuthUser>(
    headers: HeadersInit,
    options: SignUpOptions,
  ): Promise<SignUpResult<User>>;
  async signUp<User extends AuthUser = AuthUser>(
    headers: HeadersInit,
    options: SignUpOptions,
    responseOptions?: AuthServiceResponseOptions,
  ): Promise<SignUpResult<User> | AuthServiceResponse<SignUpResult<User>>> {
    if (responseOptions?.returnHeaders) {
      return (await this.auth.api.signUpEmail({
        body: options,
        headers,
        returnHeaders: true,
      })) as AuthServiceResponse<SignUpResult<User>>;
    }

    return (await this.auth.api.signUpEmail({
      body: options,
      headers,
    })) as SignUpResult<User>;
  }

  /** Signs in a user with an email address and password. */
  async signIn<User extends AuthUser = AuthUser>(
    headers: HeadersInit,
    options: SignInOptions,
    responseOptions: AuthServiceResponseOptions,
  ): Promise<AuthServiceResponse<SignInResult<User>>>;
  async signIn<User extends AuthUser = AuthUser>(
    headers: HeadersInit,
    options: SignInOptions,
  ): Promise<SignInResult<User>>;
  async signIn<User extends AuthUser = AuthUser>(
    headers: HeadersInit,
    options: SignInOptions,
    responseOptions?: AuthServiceResponseOptions,
  ): Promise<SignInResult<User> | AuthServiceResponse<SignInResult<User>>> {
    if (responseOptions?.returnHeaders) {
      const result = await this.auth.api.signInEmail({
        body: options,
        headers,
        returnHeaders: true,
      });

      return {
        headers: result.headers,
        response: this.normalizeSignInResult<User>(result.response),
      };
    }

    const result = await this.auth.api.signInEmail({
      body: options,
      headers,
    });

    return this.normalizeSignInResult<User>(result);
  }

  /** Signs out the session represented by the supplied request headers. */
  async signOut(
    headers: HeadersInit,
    responseOptions: AuthServiceResponseOptions,
  ): Promise<AuthServiceResponse<boolean>>;
  async signOut(headers: HeadersInit): Promise<boolean>;
  async signOut(
    headers: HeadersInit,
    responseOptions?: AuthServiceResponseOptions,
  ): Promise<boolean | AuthServiceResponse<boolean>> {
    if (responseOptions?.returnHeaders) {
      const result = await this.auth.api.signOut({
        headers,
        returnHeaders: true,
      });

      return {
        headers: result.headers,
        response: result.response.success,
      };
    }

    const result = await this.auth.api.signOut({ headers });
    return result.success;
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
  async verifyPassword(
    headers: HeadersInit,
    password: string,
  ): Promise<boolean> {
    const result = await this.auth.api.verifyPassword({
      body: { password },
      headers,
    });
    return result.status;
  }

  /** Updates the authenticated user's profile and configured custom fields. */
  async updateUser(
    headers: HeadersInit,
    options: UpdateAuthUserOptions,
    responseOptions: AuthServiceResponseOptions,
  ): Promise<AuthServiceResponse<boolean>>;
  async updateUser(
    headers: HeadersInit,
    options: UpdateAuthUserOptions,
  ): Promise<boolean>;
  async updateUser(
    headers: HeadersInit,
    options: UpdateAuthUserOptions,
    responseOptions?: AuthServiceResponseOptions,
  ): Promise<boolean | AuthServiceResponse<boolean>> {
    if (responseOptions?.returnHeaders) {
      const result = await this.auth.api.updateUser({
        body: options,
        headers,
        returnHeaders: true,
      });

      return {
        headers: result.headers,
        response: result.response.status,
      };
    }

    const result = await this.auth.api.updateUser({ body: options, headers });
    return result.status;
  }

  /** Starts or completes the authenticated user's configured email-change flow. */
  async changeEmail(
    headers: HeadersInit,
    options: ChangeAuthEmailOptions,
    responseOptions: AuthServiceResponseOptions,
  ): Promise<AuthServiceResponse<boolean>>;
  async changeEmail(
    headers: HeadersInit,
    options: ChangeAuthEmailOptions,
  ): Promise<boolean>;
  async changeEmail(
    headers: HeadersInit,
    options: ChangeAuthEmailOptions,
    responseOptions?: AuthServiceResponseOptions,
  ): Promise<boolean | AuthServiceResponse<boolean>> {
    if (responseOptions?.returnHeaders) {
      const result = await this.auth.api.changeEmail({
        body: options,
        headers,
        returnHeaders: true,
      });

      return {
        headers: result.headers,
        response: result.response.status,
      };
    }

    const result = await this.auth.api.changeEmail({ body: options, headers });
    return result.status;
  }

  /** Changes the authenticated user's credential password. */
  async changePassword(
    headers: HeadersInit,
    options: ChangeAuthPasswordOptions,
    responseOptions: AuthServiceResponseOptions,
  ): Promise<AuthServiceResponse<ChangeAuthPasswordResult>>;
  async changePassword(
    headers: HeadersInit,
    options: ChangeAuthPasswordOptions,
  ): Promise<ChangeAuthPasswordResult>;
  async changePassword(
    headers: HeadersInit,
    options: ChangeAuthPasswordOptions,
    responseOptions?: AuthServiceResponseOptions,
  ): Promise<
    ChangeAuthPasswordResult | AuthServiceResponse<ChangeAuthPasswordResult>
  > {
    if (responseOptions?.returnHeaders) {
      const result = await this.auth.api.changePassword({
        body: options,
        headers,
        returnHeaders: true,
      });

      return {
        headers: result.headers,
        response: { token: result.response.token },
      };
    }

    const result = await this.auth.api.changePassword({
      body: options,
      headers,
    });
    return { token: result.token };
  }

  /** Adds a credential password to an authenticated account that has none. */
  async setPassword(
    headers: HeadersInit,
    newPassword: string,
  ): Promise<boolean> {
    const result = await this.auth.api.setPassword({
      body: { newPassword },
      headers,
    });
    return result.status;
  }

  /** Requests deletion of the authenticated user's account. */
  async deleteUser(
    headers: HeadersInit,
    options: DeleteAuthUserOptions,
    responseOptions: AuthServiceResponseOptions,
  ): Promise<AuthServiceResponse<DeleteAuthUserResult>>;
  async deleteUser(
    headers: HeadersInit,
    options?: DeleteAuthUserOptions,
  ): Promise<DeleteAuthUserResult>;
  async deleteUser(
    headers: HeadersInit,
    options: DeleteAuthUserOptions = {},
    responseOptions?: AuthServiceResponseOptions,
  ): Promise<DeleteAuthUserResult | AuthServiceResponse<DeleteAuthUserResult>> {
    if (responseOptions?.returnHeaders) {
      return await this.auth.api.deleteUser({
        body: options,
        headers,
        returnHeaders: true,
      });
    }

    return await this.auth.api.deleteUser({ body: options, headers });
  }

  /** Lists safe summaries of authentication accounts linked to the current user. */
  async listAccounts(headers: HeadersInit): Promise<AuthAccount[]> {
    return await this.auth.api.listUserAccounts({ headers });
  }

  /** Unlinks an authentication account from the current user. */
  async unlinkAccount(
    headers: HeadersInit,
    options: UnlinkAuthAccountOptions,
  ): Promise<boolean> {
    const result = await this.auth.api.unlinkAccount({
      body: options,
      headers,
    });
    return result.status;
  }

  /** Returns a usable provider access token for a linked account. */
  async getAccessToken(
    headers: HeadersInit,
    selector: AuthAccountSelector,
  ): Promise<AuthAccessToken> {
    const result = await this.auth.api.getAccessToken({
      body: selector,
      headers,
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
    headers: HeadersInit,
    selector: AuthAccountSelector,
  ): Promise<AuthRefreshedToken> {
    const result = await this.auth.api.refreshToken({
      body: selector,
      headers,
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
  >(
    headers: HeadersInit,
    selector: AuthAccountSelector,
  ): Promise<AuthAccountInfo<UserInfo, Data>> {
    return (await this.auth.api.accountInfo({
      query: selector,
      headers,
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
}
