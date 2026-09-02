import { Inject, Injectable } from "@nestjs/common";

import { AUTH_TOKEN } from "./auth.constants.js";
import type {
  AuthAccount,
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
    signUpEmail(options: {
      body: SignUpOptions;
      headers: HeadersInit;
    }): Promise<SignUpResult>;
    signInEmail(options: {
      body: SignInOptions;
      headers: HeadersInit;
    }): Promise<Omit<SignInResult, "url"> & { url?: string }>;
    signOut(options: { headers: HeadersInit }): Promise<{ success: boolean }>;
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
    changeEmail(options: {
      body: ChangeAuthEmailOptions;
      headers: HeadersInit;
    }): Promise<StatusResult>;
    changePassword(options: {
      body: ChangeAuthPasswordOptions;
      headers: HeadersInit;
    }): Promise<{ token: string | null }>;
    setPassword(options: {
      body: { newPassword: string };
      headers: HeadersInit;
    }): Promise<StatusResult>;
    deleteUser(options: {
      body: DeleteAuthUserOptions;
      headers: HeadersInit;
    }): Promise<DeleteAuthUserResult>;
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
  ): Promise<SignUpResult<User>> {
    return (await this.auth.api.signUpEmail({
      body: options,
      headers,
    })) as SignUpResult<User>;
  }

  /** Signs in a user with an email address and password. */
  async signIn<User extends AuthUser = AuthUser>(
    headers: HeadersInit,
    options: SignInOptions,
  ): Promise<SignInResult<User>> {
    const result = await this.auth.api.signInEmail({
      body: options,
      headers,
    });

    return {
      ...result,
      url: result.url ?? null,
    } as SignInResult<User>;
  }

  /** Signs out the session represented by the supplied request headers. */
  async signOut(headers: HeadersInit): Promise<boolean> {
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
  ): Promise<boolean> {
    const result = await this.auth.api.updateUser({ body: options, headers });
    return result.status;
  }

  /** Starts or completes the authenticated user's configured email-change flow. */
  async changeEmail(
    headers: HeadersInit,
    options: ChangeAuthEmailOptions,
  ): Promise<boolean> {
    const result = await this.auth.api.changeEmail({ body: options, headers });
    return result.status;
  }

  /** Changes the authenticated user's credential password. */
  async changePassword(
    headers: HeadersInit,
    options: ChangeAuthPasswordOptions,
  ): Promise<ChangeAuthPasswordResult> {
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
    options: DeleteAuthUserOptions = {},
  ): Promise<DeleteAuthUserResult> {
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
}
