import { RequestContext } from "@nest-boot/request-context";
import { ForbiddenException } from "@nestjs/common";
import type { Mocked } from "vitest";

import { AuthAbility } from "../abilities/auth.ability.js";
import { Member } from "../entities/member.entity.js";
import { User } from "../entities/user.entity.js";
import { type User as BaseUser } from "../entities/user.entity.js";
import { Workspace } from "../entities/workspace.entity.js";
import { AccessControlService } from "../services/access-control.service.js";
import { type AuthService } from "../services/auth.service.js";
import { AuthResolver } from "./auth.resolver.js";

describe("AuthResolver", () => {
  it("preserves conditional and deny rules when serializing abilities for the client", async () => {
    const { resolver } = createResolver();
    const conditions = { id: "user-1" };
    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      expect(() => resolver.currentAbilityRules()).toThrow(ForbiddenException);
      RequestContext.set(AccessControlService, new AccessControlService({}));
      RequestContext.set(User, new User());
      RequestContext.set(Member, new Member());
      RequestContext.set(Workspace, new Workspace());
      RequestContext.set(
        AuthAbility,
        new AuthAbility([
          {
            action: "read",
            subject: User,
            fields: ["name", "email"],
            conditions,
          },
          {
            action: "delete",
            subject: User,
            inverted: true,
            reason: "Protected account",
          },
          { action: ["read", "update"], subject: [Workspace, "Member"] },
        ]),
      );
      const rules = resolver.currentAbilityRules();
      expect(rules).toEqual([
        {
          actions: ["read"],
          subjects: ["User"],
          fields: ["name", "email"],
          conditions,
          inverted: false,
          reason: null,
        },
        {
          actions: ["delete"],
          subjects: ["User"],
          fields: null,
          conditions: null,
          inverted: true,
          reason: "Protected account",
        },
        {
          actions: ["read", "update"],
          subjects: ["Workspace", "Member"],
          fields: null,
          conditions: null,
          inverted: false,
          reason: null,
        },
      ]);
      expect(JSON.parse(JSON.stringify(rules))).toEqual(rules);
      expect(resolver.currentAbilityRules()).toContainEqual({
        actions: ["read", "update"],
        subjects: ["Workspace", "Member"],
        fields: null,
        conditions: null,
        inverted: false,
        reason: null,
      });
    });
  });

  it.each([null, "session-token"])(
    "returns the registration payload with token %j",
    async (token) => {
      const payload = { id: "user-1", token };
      const { resolver, authService } = createResolver({
        signUpPayload: vi.fn().mockResolvedValue(payload),
      });
      const input = {
        name: "Alice",
        email: "alice@example.com",
        password: "password",
      };
      await expect(resolver.signUp(input)).resolves.toEqual(payload);
      expect(authService.signUpPayload).toHaveBeenCalledWith(input);
    },
  );

  it("maps the account target id to the auth service's accountId option", async () => {
    const { resolver, authService } = createResolver({
      unlinkCurrentUserAccount: vi.fn().mockResolvedValue(true),
    });
    await expect(resolver.unlinkCurrentUserAccount("account-1")).resolves.toBe(
      true,
    );
    expect(authService.unlinkCurrentUserAccount).toHaveBeenCalledWith({
      accountId: "account-1",
    });
  });
  it("returns the current authenticated user", () => {
    const user = { id: "user-1" } as BaseUser;
    const { resolver } = createResolver({ getCurrentUser: vi.fn(() => user) });

    expect(resolver.currentUser()).toBe(user);
  });

  it("rejects an authenticated principal without a user identity", () => {
    const { resolver } = createResolver({
      getCurrentUser: vi.fn(() => {
        throw new ForbiddenException();
      }),
    });

    expect(() => resolver.currentUser()).toThrow(ForbiddenException);
  });

  it("exposes configured social providers without requiring a session", async () => {
    const { authService, resolver } = createResolver({
      listSocialProviders: vi.fn(async () => [
        { id: "company", name: "Company SSO" },
      ]),
    });

    await expect(resolver.socialProviders()).resolves.toEqual([
      { id: "company", name: "Company SSO" },
    ]);
    expect(authService.listSocialProviders).toHaveBeenCalledWith();
  });

  it("signs in through AuthService", async () => {
    const result = {
      redirect: false,
      token: "session-token",
      url: null,
      user: { id: "user-1" },
    };
    const { authService, resolver } = createResolver({
      signInEntity: vi.fn(async () => result),
    });

    await expect(
      resolver.signIn({
        email: "alice@example.com",
        password: "password",
      }),
    ).resolves.toBe(result);
    expect(authService.signInEntity).toHaveBeenCalledWith({
      email: "alice@example.com",
      password: "password",
    });
  });

  it("starts social sign-in through AuthService", async () => {
    const result = {
      redirect: true,
      token: null,
      url: "https://identity.example.com/authorize",
      user: null,
    };
    const { authService, resolver } = createResolver({
      signInSocialEntity: vi.fn(async () => result),
    });
    const input = {
      callbackURL: "https://app.example.com",
      provider: "company",
    };

    await expect(resolver.signInSocial(input)).resolves.toBe(result);
    expect(authService.signInSocialEntity).toHaveBeenCalledWith({
      ...input,
      disableRedirect: true,
    });
  });
  it("starts social account linking without exposing Better Auth directly", async () => {
    const result = {
      redirect: false,
      url: "https://identity.example.com/authorize",
    };
    const { authService, resolver } = createResolver({
      linkCurrentUserAccount: vi.fn(async () => result),
    });
    const input = {
      callbackURL: "https://app.example.com/user/security",
      provider: "oidc",
      scopes: ["openid"],
    };

    await expect(resolver.linkCurrentUserAccount(input)).resolves.toBe(result);
    expect(authService.linkCurrentUserAccount).toHaveBeenCalledWith({
      ...input,
      disableRedirect: true,
    });
  });

  it("updates the user through AuthService", async () => {
    const { authService, resolver } = createResolver({
      updateCurrentUser: vi.fn(async () => true),
    });

    await expect(resolver.updateCurrentUser({ name: "Renamed" })).resolves.toBe(
      true,
    );
    expect(authService.updateCurrentUser).toHaveBeenCalledWith({
      name: "Renamed",
    });
  });

  it("changes the password through AuthService", async () => {
    const result = { token: "replacement-token" };
    const { authService, resolver } = createResolver({
      changeCurrentUserPassword: vi.fn(async () => result),
    });
    const input = {
      currentPassword: "old-password",
      newPassword: "new-password",
      revokeOtherSessions: true,
    };

    await expect(resolver.changeCurrentUserPassword(input)).resolves.toBe(
      result,
    );
    expect(authService.changeCurrentUserPassword).toHaveBeenCalledWith(input);
  });

  it("starts an email change through AuthService", async () => {
    const { authService, resolver } = createResolver({
      changeCurrentUserEmail: vi.fn(async () => true),
    });
    const input = {
      callbackURL: "https://app.example.com/user?emailChanged=true",
      newEmail: "next@example.com",
    };

    await expect(resolver.changeCurrentUserEmail(input)).resolves.toBe(true);
    expect(authService.changeCurrentUserEmail).toHaveBeenCalledWith(input);
  });

  it("deletes the current user through AuthService", async () => {
    const result = { message: "User deleted", success: true };
    const { authService, resolver } = createResolver({
      deleteCurrentUser: vi.fn(async () => result),
    });

    await expect(
      resolver.deleteCurrentUser({ password: "password" }),
    ).resolves.toBe(result);
    expect(authService.deleteCurrentUser).toHaveBeenCalledWith({
      password: "password",
    });
  });
});

function createResolver(overrides: Record<string, unknown> = {}) {
  const authService = { ...overrides } as unknown as Mocked<AuthService>;
  return { authService, resolver: new AuthResolver(authService) };
}
