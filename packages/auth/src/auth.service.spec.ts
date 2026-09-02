import { Test } from "@nestjs/testing";

import { AUTH_TOKEN } from "./auth.constants.js";
import { AuthService } from "./auth.service.js";

function createApi() {
  return {
    changeEmail: vi.fn(),
    changePassword: vi.fn(),
    deleteUser: vi.fn(),
    listUserAccounts: vi.fn(),
    requestPasswordReset: vi.fn(),
    resetPassword: vi.fn(),
    sendVerificationEmail: vi.fn(),
    setPassword: vi.fn(),
    signInEmail: vi.fn(),
    signOut: vi.fn(),
    signUpEmail: vi.fn(),
    unlinkAccount: vi.fn(),
    updateUser: vi.fn(),
    verifyPassword: vi.fn(),
  };
}

async function createService(api = createApi()) {
  const moduleRef = await Test.createTestingModule({
    providers: [
      AuthService,
      {
        provide: AUTH_TOKEN,
        useValue: { api },
      },
    ],
  }).compile();

  return {
    api,
    service: moduleRef.get(AuthService),
  };
}

describe("AuthService", () => {
  const headers = new Headers({ cookie: "session=value" });

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
    api.signUpEmail.mockResolvedValue(result);

    await expect(service.signUp(headers, options)).resolves.toBe(result);
    expect(api.signUpEmail).toHaveBeenCalledWith({ body: options, headers });
  });

  it("signs in with email and password and normalizes an absent URL", async () => {
    const { api, service } = await createService();
    const options = {
      email: "alice@example.com",
      password: "password",
      rememberMe: true,
    };
    api.signInEmail.mockResolvedValue({
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
    });

    await expect(service.signIn(headers, options)).resolves.toEqual({
      redirect: false,
      token: "session-token",
      url: null,
      user: expect.objectContaining({ id: "user-1" }),
    });
    expect(api.signInEmail).toHaveBeenCalledWith({ body: options, headers });
  });

  it("signs out the session represented by the request headers", async () => {
    const { api, service } = await createService();
    api.signOut.mockResolvedValue({ success: true });

    await expect(service.signOut(headers)).resolves.toBe(true);
    expect(api.signOut).toHaveBeenCalledWith({ headers });
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

    await expect(service.verifyPassword(headers, "password")).resolves.toBe(
      true,
    );
    expect(api.verifyPassword).toHaveBeenCalledWith({
      body: { password: "password" },
      headers,
    });
  });

  it("updates the current user without exposing the Better Auth API", async () => {
    const { api, service } = await createService();
    api.updateUser.mockResolvedValue({ status: true });
    const options = { image: null, name: "Alice", timezone: "UTC" };

    await expect(service.updateUser(headers, options)).resolves.toBe(true);
    expect(api.updateUser).toHaveBeenCalledWith({ body: options, headers });
    expect("api" in service).toBe(false);
  });

  it("changes the current user's email", async () => {
    const { api, service } = await createService();
    api.changeEmail.mockResolvedValue({ status: true });
    const options = {
      callbackURL: "/account",
      newEmail: "next@example.com",
    };

    await expect(service.changeEmail(headers, options)).resolves.toBe(true);
    expect(api.changeEmail).toHaveBeenCalledWith({ body: options, headers });
  });

  it("changes the password and only exposes the replacement token", async () => {
    const { api, service } = await createService();
    api.changePassword.mockResolvedValue({
      token: "replacement-token",
      user: { id: "user-1" },
    });
    const options = {
      currentPassword: "old-password",
      newPassword: "new-password",
      revokeOtherSessions: true,
    };

    await expect(service.changePassword(headers, options)).resolves.toEqual({
      token: "replacement-token",
    });
    expect(api.changePassword).toHaveBeenCalledWith({ body: options, headers });
  });

  it("adds a password to an account without credentials", async () => {
    const { api, service } = await createService();
    api.setPassword.mockResolvedValue({ status: true });

    await expect(service.setPassword(headers, "new-password")).resolves.toBe(
      true,
    );
    expect(api.setPassword).toHaveBeenCalledWith({
      body: { newPassword: "new-password" },
      headers,
    });
  });

  it("requests user deletion with empty default options", async () => {
    const { api, service } = await createService();
    api.deleteUser.mockResolvedValue({
      message: "User deleted",
      success: true,
    });

    await expect(service.deleteUser(headers)).resolves.toEqual({
      message: "User deleted",
      success: true,
    });
    expect(api.deleteUser).toHaveBeenCalledWith({ body: {}, headers });
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

    await expect(service.listAccounts(headers)).resolves.toBe(accounts);
    expect(api.listUserAccounts).toHaveBeenCalledWith({ headers });
  });

  it("unlinks an account", async () => {
    const { api, service } = await createService();
    api.unlinkAccount.mockResolvedValue({ status: true });
    const options = { accountId: "account-1" };

    await expect(service.unlinkAccount(headers, options)).resolves.toBe(true);
    expect(api.unlinkAccount).toHaveBeenCalledWith({ body: options, headers });
  });
});
