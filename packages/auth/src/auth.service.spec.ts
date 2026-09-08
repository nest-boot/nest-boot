import { REQUEST, RequestContext, RESPONSE } from "@nest-boot/request-context";
import { Test } from "@nestjs/testing";

import { AUTH_TOKEN } from "./auth.constants.js";
import { AuthService } from "./auth.service.js";

const requestHeaders = vi.hoisted(
  () => new Headers({ cookie: "session=value" }),
);

vi.mock("@nest-boot/request-context", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@nest-boot/request-context")>()),
  headers: () => requestHeaders,
}));

function createApi() {
  return {
    accountInfo: vi.fn(),
    changeEmail: vi.fn(),
    changePassword: vi.fn(),
    deleteUser: vi.fn(),
    getAccessToken: vi.fn(),
    listUserAccounts: vi.fn(),
    linkSocialAccount: vi.fn(),
    refreshToken: vi.fn(),
    requestPasswordReset: vi.fn(),
    resetPassword: vi.fn(),
    sendVerificationEmail: vi.fn(),
    setPassword: vi.fn(),
    signInEmail: vi.fn(),
    signInSocial: vi.fn(),
    signOut: vi.fn(),
    signUpEmail: vi.fn(),
    unlinkAccount: vi.fn(),
    updateUser: vi.fn(),
    verifyPassword: vi.fn(),
  };
}

async function createService(
  api = createApi(),
  socialProviders: { id: string; name: string }[] = [],
) {
  const moduleRef = await Test.createTestingModule({
    providers: [
      AuthService,
      {
        provide: AUTH_TOKEN,
        useValue: {
          $context: Promise.resolve({
            socialProviders,
          }),
          api,
        },
      },
    ],
  }).compile();

  return {
    api,
    service: moduleRef.get(AuthService),
  };
}

async function withResponse<T>(callback: () => Promise<T>) {
  const appendHeader = vi.fn();
  const context = new RequestContext({ type: "http" });
  context.set(REQUEST, { headers: {} });
  context.set(RESPONSE, { appendHeader });

  return {
    appendHeader,
    result: await RequestContext.run(context, callback),
  };
}

describe("AuthService", () => {
  it("lists the configured social and generic OAuth providers", async () => {
    const { service } = await createService(createApi(), [
      { id: "github", name: "GitHub" },
      { id: "company", name: "Company SSO" },
    ]);

    await expect(service.listSocialProviders()).resolves.toEqual([
      { id: "github", name: "GitHub" },
      { id: "company", name: "Company SSO" },
    ]);
  });

  it("signs up with email and password through the internal auth adapter", async () => {
    const { api, service } = await createService();
    const options = {
      callbackURL: "/verify-email",
      email: "alice@example.com",
      name: "Alice",
      password: "password",
      plan: "starter",
      rememberMe: false,
    };
    const result = {
      token: null,
      user: {
        createdAt: new Date("2026-01-01"),
        email: options.email,
        emailVerified: false,
        id: "user-1",
        name: options.name,
        plan: options.plan,
        updatedAt: new Date("2026-01-01"),
      },
    };
    api.signUpEmail.mockResolvedValue({
      headers: new Headers(),
      response: result,
    });

    await expect(service.signUp(options)).resolves.toBe(result);
    expect(api.signUpEmail).toHaveBeenCalledWith({
      body: options,
      headers: requestHeaders,
      returnHeaders: true,
    });
  });

  it("signs in with email and password and normalizes an absent URL", async () => {
    const { api, service } = await createService();
    const options = {
      email: "alice@example.com",
      password: "password",
      rememberMe: true,
    };
    api.signInEmail.mockResolvedValue({
      headers: new Headers(),
      response: {
        redirect: false,
        token: "session-token",
        user: {
          createdAt: new Date("2026-01-01"),
          email: options.email,
          emailVerified: true,
          id: "user-1",
          name: "Alice",
          updatedAt: new Date("2026-01-01"),
        },
      },
    });

    await expect(service.signIn(options)).resolves.toEqual({
      redirect: false,
      token: "session-token",
      url: null,
      user: expect.objectContaining({ id: "user-1" }),
    });
    expect(api.signInEmail).toHaveBeenCalledWith({
      body: options,
      headers: requestHeaders,
      returnHeaders: true,
    });
  });

  it("applies every sign-in cookie to the current HTTP response", async () => {
    const { api, service } = await createService();
    const responseHeaders = new Headers();
    responseHeaders.append("set-cookie", "session=value; Path=/");
    responseHeaders.append("set-cookie", "session-data=value; Path=/");
    const options = {
      email: "alice@example.com",
      password: "password",
    };
    api.signInEmail.mockResolvedValue({
      headers: responseHeaders,
      response: {
        redirect: false,
        token: "session-token",
        user: {
          createdAt: new Date("2026-01-01"),
          email: options.email,
          emailVerified: true,
          id: "user-1",
          name: "Alice",
          updatedAt: new Date("2026-01-01"),
        },
      },
    });

    const { appendHeader, result: actual } = await withResponse(() =>
      service.signIn(options),
    );

    expect(actual).toEqual(expect.objectContaining({ url: null }));
    expect(appendHeader).toHaveBeenNthCalledWith(
      1,
      "Set-Cookie",
      "session=value; Path=/",
    );
    expect(appendHeader).toHaveBeenNthCalledWith(
      2,
      "Set-Cookie",
      "session-data=value; Path=/",
    );
    expect(api.signInEmail).toHaveBeenCalledWith({
      body: options,
      headers: requestHeaders,
      returnHeaders: true,
    });
  });

  it("rejects response cookies outside an HTTP response context", async () => {
    const { api, service } = await createService();
    api.signInEmail.mockResolvedValue({
      headers: new Headers({ "set-cookie": "session=value" }),
      response: {
        redirect: false,
        token: "session-token",
        user: {
          createdAt: new Date("2026-01-01"),
          email: "alice@example.com",
          emailVerified: true,
          id: "user-1",
          name: "Alice",
          updatedAt: new Date("2026-01-01"),
        },
      },
    });

    await expect(
      service.signIn({
        email: "alice@example.com",
        password: "password",
      }),
    ).rejects.toThrow(
      "cookies() is only available within an HTTP request context",
    );
  });

  it("starts a social sign-in flow and normalizes redirect results", async () => {
    const { api, service } = await createService();
    const options = {
      callbackURL: "https://app.example.com",
      disableRedirect: true,
      provider: "company",
    };
    api.signInSocial.mockResolvedValue({
      headers: new Headers(),
      response: {
        redirect: true,
        url: "https://identity.example.com/authorize",
      },
    });

    await expect(service.signInSocial(options)).resolves.toEqual({
      redirect: true,
      token: null,
      url: "https://identity.example.com/authorize",
      user: null,
    });
    expect(api.signInSocial).toHaveBeenCalledWith({
      body: options,
      headers: requestHeaders,
      returnHeaders: true,
    });
  });

  it("applies social sign-in cookies and normalizes direct-token results", async () => {
    const { api, service } = await createService();
    const responseHeaders = new Headers({
      "set-cookie": "session=value; Path=/",
    });
    const options = { provider: "github" };
    const user = {
      createdAt: new Date("2026-01-01"),
      email: "alice@example.com",
      emailVerified: true,
      id: "user-1",
      name: "Alice",
      updatedAt: new Date("2026-01-01"),
    };
    api.signInSocial.mockResolvedValue({
      headers: responseHeaders,
      response: {
        redirect: false,
        token: "session-token",
        user,
      },
    });

    const { appendHeader, result } = await withResponse(() =>
      service.signInSocial(options),
    );

    expect(result).toEqual({
      redirect: false,
      token: "session-token",
      url: null,
      user,
    });
    expect(appendHeader).toHaveBeenCalledWith(
      "Set-Cookie",
      "session=value; Path=/",
    );
    expect(api.signInSocial).toHaveBeenCalledWith({
      body: options,
      headers: requestHeaders,
      returnHeaders: true,
    });
  });

  it("signs out the session represented by the request headers", async () => {
    const { api, service } = await createService();
    api.signOut.mockResolvedValue({
      headers: new Headers(),
      response: { success: true },
    });

    await expect(service.signOut()).resolves.toBe(true);
    expect(api.signOut).toHaveBeenCalledWith({
      headers: requestHeaders,
      returnHeaders: true,
    });
  });

  it("sends an email verification link", async () => {
    const { api, service } = await createService();
    const options = {
      callbackURL: "/account",
      email: "alice@example.com",
    };
    api.sendVerificationEmail.mockResolvedValue({ status: true });

    await expect(service.sendVerificationEmail(options)).resolves.toBe(true);
    expect(api.sendVerificationEmail).toHaveBeenCalledWith({ body: options });
  });

  it("requests a password reset without revealing whether the user exists", async () => {
    const { api, service } = await createService();
    const options = {
      email: "alice@example.com",
      redirectTo: "/reset-password",
    };
    const result = {
      message:
        "If this email exists in our system, check your email for the reset link",
      status: true,
    };
    api.requestPasswordReset.mockResolvedValue(result);

    await expect(service.requestPasswordReset(options)).resolves.toBe(result);
    expect(api.requestPasswordReset).toHaveBeenCalledWith({ body: options });
  });

  it("resets a password with a reset token", async () => {
    const { api, service } = await createService();
    const options = {
      newPassword: "new-password",
      token: "reset-token",
    };
    api.resetPassword.mockResolvedValue({ status: true });

    await expect(service.resetPassword(options)).resolves.toBe(true);
    expect(api.resetPassword).toHaveBeenCalledWith({ body: options });
  });

  it("verifies the authenticated user's credential password", async () => {
    const { api, service } = await createService();
    api.verifyPassword.mockResolvedValue({ status: true });

    await expect(service.verifyPassword("password")).resolves.toBe(true);
    expect(api.verifyPassword).toHaveBeenCalledWith({
      body: { password: "password" },
      headers: requestHeaders,
    });
  });

  it("updates the current user without exposing the Better Auth API", async () => {
    const { api, service } = await createService();
    api.updateUser.mockResolvedValue({
      headers: new Headers(),
      response: { status: true },
    });
    const options = { image: null, name: "Alice", timezone: "UTC" };

    await expect(service.updateUser(options)).resolves.toBe(true);
    expect(api.updateUser).toHaveBeenCalledWith({
      body: options,
      headers: requestHeaders,
      returnHeaders: true,
    });
    expect("api" in service).toBe(false);
  });

  it("applies refreshed session cookies when updating the current user", async () => {
    const { api, service } = await createService();
    const responseHeaders = new Headers({
      "set-cookie": "better-auth.session_data=updated; Path=/",
    });
    const options = { name: "Alice" };
    api.updateUser.mockResolvedValue({
      headers: responseHeaders,
      response: { status: true },
    });

    const { appendHeader, result } = await withResponse(() =>
      service.updateUser(options),
    );
    expect(result).toBe(true);
    expect(appendHeader).toHaveBeenCalledWith(
      "Set-Cookie",
      "better-auth.session_data=updated; Path=/",
    );
    expect(api.updateUser).toHaveBeenCalledWith({
      body: options,
      headers: requestHeaders,
      returnHeaders: true,
    });
  });

  it("changes the current user's email", async () => {
    const { api, service } = await createService();
    api.changeEmail.mockResolvedValue({
      headers: new Headers(),
      response: { status: true },
    });
    const options = {
      callbackURL: "/account",
      newEmail: "next@example.com",
    };

    await expect(service.changeEmail(options)).resolves.toBe(true);
    expect(api.changeEmail).toHaveBeenCalledWith({
      body: options,
      headers: requestHeaders,
      returnHeaders: true,
    });
  });

  it("applies refreshed session cookies during an email change", async () => {
    const { api, service } = await createService();
    const responseHeaders = new Headers({
      "set-cookie": "session_data=updated; Path=/; HttpOnly",
    });
    const options = {
      callbackURL: "/user?emailChanged=true",
      newEmail: "next@example.com",
    };
    api.changeEmail.mockResolvedValue({
      headers: responseHeaders,
      response: { status: true },
    });

    const { appendHeader, result } = await withResponse(() =>
      service.changeEmail(options),
    );
    expect(result).toBe(true);
    expect(appendHeader).toHaveBeenCalledWith(
      "Set-Cookie",
      "session_data=updated; Path=/; HttpOnly",
    );
    expect(api.changeEmail).toHaveBeenCalledWith({
      body: options,
      headers: requestHeaders,
      returnHeaders: true,
    });
  });

  it("changes the password and only exposes the replacement token", async () => {
    const { api, service } = await createService();
    api.changePassword.mockResolvedValue({
      headers: new Headers(),
      response: {
        token: "replacement-token",
        user: { id: "user-1" },
      },
    });
    const options = {
      currentPassword: "old-password",
      newPassword: "new-password",
      revokeOtherSessions: true,
    };

    await expect(service.changePassword(options)).resolves.toEqual({
      token: "replacement-token",
    });
    expect(api.changePassword).toHaveBeenCalledWith({
      body: options,
      headers: requestHeaders,
      returnHeaders: true,
    });
  });

  it("applies the replacement session cookie after a password change", async () => {
    const { api, service } = await createService();
    const responseHeaders = new Headers({
      "set-cookie": "session=replacement; Path=/; HttpOnly",
    });
    const options = {
      currentPassword: "old-password",
      newPassword: "new-password",
      revokeOtherSessions: true,
    };
    api.changePassword.mockResolvedValue({
      headers: responseHeaders,
      response: { token: "replacement-token", user: { id: "user-1" } },
    });

    const { appendHeader, result } = await withResponse(() =>
      service.changePassword(options),
    );
    expect(result).toEqual({ token: "replacement-token" });
    expect(appendHeader).toHaveBeenCalledWith(
      "Set-Cookie",
      "session=replacement; Path=/; HttpOnly",
    );
    expect(api.changePassword).toHaveBeenCalledWith({
      body: options,
      headers: requestHeaders,
      returnHeaders: true,
    });
  });

  it("adds a password to an account without credentials", async () => {
    const { api, service } = await createService();
    api.setPassword.mockResolvedValue({ status: true });

    await expect(service.setPassword("new-password")).resolves.toBe(true);
    expect(api.setPassword).toHaveBeenCalledWith({
      body: { newPassword: "new-password" },
      headers: requestHeaders,
    });
  });

  it("requests user deletion with empty default options", async () => {
    const { api, service } = await createService();
    api.deleteUser.mockResolvedValue({
      headers: new Headers(),
      response: {
        message: "User deleted",
        success: true,
      },
    });

    await expect(service.deleteUser()).resolves.toEqual({
      message: "User deleted",
      success: true,
    });
    expect(api.deleteUser).toHaveBeenCalledWith({
      body: {},
      headers: requestHeaders,
      returnHeaders: true,
    });
  });

  it("applies cookie removal headers after deleting the current user", async () => {
    const { api, service } = await createService();
    const responseHeaders = new Headers({
      "set-cookie": "better-auth.session_token=; Max-Age=0; Path=/",
    });
    const response = { message: "User deleted", success: true };
    api.deleteUser.mockResolvedValue({ headers: responseHeaders, response });

    const { appendHeader, result } = await withResponse(() =>
      service.deleteUser({}),
    );
    expect(result).toEqual(response);
    expect(appendHeader).toHaveBeenCalledWith(
      "Set-Cookie",
      "better-auth.session_token=; Max-Age=0; Path=/",
    );
    expect(api.deleteUser).toHaveBeenCalledWith({
      body: {},
      headers: requestHeaders,
      returnHeaders: true,
    });
  });

  it("lists safe linked-account summaries", async () => {
    const { api, service } = await createService();
    const accounts = [
      {
        accountId: "provider-user",
        createdAt: new Date("2026-01-01"),
        id: "account-1",
        issuer: "local:oauth:github",
        providerId: "github",
        scopes: ["user:email"],
        updatedAt: new Date("2026-01-02"),
        userId: "user-1",
      },
    ];
    api.listUserAccounts.mockResolvedValue(accounts);

    await expect(service.listAccounts()).resolves.toBe(accounts);
    expect(api.listUserAccounts).toHaveBeenCalledWith({
      headers: requestHeaders,
    });
  });

  it("starts a social account-linking flow", async () => {
    const { api, service } = await createService();
    const options = {
      callbackURL: "/user/security",
      disableRedirect: true,
      provider: "oidc",
      scopes: ["openid", "profile"],
    };
    const result = {
      redirect: true,
      url: "https://identity.example.com/authorize",
    };
    api.linkSocialAccount.mockResolvedValue({
      headers: new Headers(),
      response: result,
    });

    await expect(service.linkSocialAccount(options)).resolves.toBe(result);
    expect(api.linkSocialAccount).toHaveBeenCalledWith({
      body: options,
      headers: requestHeaders,
      returnHeaders: true,
    });
  });

  it("applies account-linking state cookies", async () => {
    const { api, service } = await createService();
    const options = {
      callbackURL: "/user/security",
      disableRedirect: true,
      provider: "company",
    };
    const headers = new Headers({
      "set-cookie": "oauth-state=value; Path=/",
    });
    const response = {
      redirect: false,
      url: "https://identity.example.com/authorize",
    };
    api.linkSocialAccount.mockResolvedValue({ headers, response });

    const { appendHeader, result } = await withResponse(() =>
      service.linkSocialAccount(options),
    );
    expect(result).toEqual(response);
    expect(appendHeader).toHaveBeenCalledWith(
      "Set-Cookie",
      "oauth-state=value; Path=/",
    );
    expect(api.linkSocialAccount).toHaveBeenCalledWith({
      body: options,
      headers: requestHeaders,
      returnHeaders: true,
    });
  });

  it("unlinks an account", async () => {
    const { api, service } = await createService();
    api.unlinkAccount.mockResolvedValue({ status: true });
    const options = { accountId: "account-1" };

    await expect(service.unlinkAccount(options)).resolves.toBe(true);
    expect(api.unlinkAccount).toHaveBeenCalledWith({
      body: options,
      headers: requestHeaders,
    });
  });

  it("gets and normalizes a provider access token", async () => {
    const { api, service } = await createService();
    api.getAccessToken.mockResolvedValue({
      accessToken: "access-token",
      scopes: ["openid", "profile"],
    });

    await expect(
      service.getAccessToken({ accountId: "account-1" }),
    ).resolves.toEqual({
      accessToken: "access-token",
      accessTokenExpiresAt: null,
      idToken: null,
      scopes: ["openid", "profile"],
    });
    expect(api.getAccessToken).toHaveBeenCalledWith({
      body: { accountId: "account-1" },
      headers: requestHeaders,
    });
  });

  it("refreshes and normalizes provider credentials", async () => {
    const { api, service } = await createService();
    api.refreshToken.mockResolvedValue({
      accountId: "account-1",
      providerId: "oidc",
      refreshToken: "refresh-token",
    });

    await expect(
      service.refreshToken({ accountId: "account-1" }),
    ).resolves.toEqual({
      accessToken: null,
      accessTokenExpiresAt: null,
      accountId: "account-1",
      idToken: null,
      providerId: "oidc",
      refreshToken: "refresh-token",
      refreshTokenExpiresAt: null,
      scope: null,
    });
  });

  it("returns provider account information", async () => {
    const { api, service } = await createService();
    const result = {
      account: {
        accountId: "provider-user",
        id: "account-1",
        issuer: "https://issuer.example.com",
        providerId: "oidc",
      },
      data: { tenant: "acme" },
      user: { emailVerified: true, name: "Alice" },
    };
    api.accountInfo.mockResolvedValue(result);

    await expect(service.accountInfo({ accountId: "account-1" })).resolves.toBe(
      result,
    );
    expect(api.accountInfo).toHaveBeenCalledWith({
      headers: requestHeaders,
      query: { accountId: "account-1" },
    });
  });
});
