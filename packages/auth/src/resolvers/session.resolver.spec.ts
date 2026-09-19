import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { MODULE_METADATA } from "@nestjs/common/constants";
import type { Mocked } from "vitest";

import { AuthModule } from "../auth.module.js";
import { type Session } from "../entities/session.entity.js";
import { type User } from "../entities/user.entity.js";
import { type AuthService } from "../services/auth.service.js";
import { type SessionService } from "../services/session.service.js";
import { AuthResolver } from "./auth.resolver.js";
import { SessionResolver } from "./session.resolver.js";
import { UserResolver } from "./user.resolver.js";

describe("SessionResolver", () => {
  it("delegates impersonator reads to SessionService and preserves access failures", async () => {
    const user = { id: "admin" } as User;
    const session = { id: "session" } as Session;
    const getSessionImpersonator = vi.fn().mockResolvedValue(user);
    const { resolver } = createResolver({ getSessionImpersonator });
    await expect(resolver.impersonatedBy(session)).resolves.toBe(user);
    expect(getSessionImpersonator).toHaveBeenCalledWith(session);
    getSessionImpersonator.mockResolvedValueOnce(null);
    await expect(resolver.impersonatedBy(session)).resolves.toBeNull();
    getSessionImpersonator.mockRejectedValueOnce(new ForbiddenException());
    await expect(resolver.impersonatedBy(session)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it("owns session operations and is registered by default", () => {
    expect(
      Reflect.getMetadata(MODULE_METADATA.PROVIDERS, AuthModule),
    ).toContain(SessionResolver);
    expect(AuthResolver.prototype).not.toHaveProperty("currentSession");
    expect(AuthResolver.prototype).not.toHaveProperty("authSessions");
    expect(UserResolver.prototype).not.toHaveProperty("userSessions");
    expect(UserResolver.prototype).not.toHaveProperty("impersonateUser");
  });

  it("returns the application session and resolves computed fields", () => {
    const { resolver } = createResolver();
    const session = {
      id: "session-1",
      token: "secret",
      impersonatedBy: { id: "admin-1" },
    } as Session;
    expect(resolver.currentSession(session)).toBe(session);
    expect(resolver.current(session, session)).toBe(true);
    expect(resolver.current(session, null)).toBe(false);
    expect(resolver.current(session, { id: "other-session" } as Session)).toBe(
      false,
    );
    expect(resolver.impersonatedById(session)).toBe("admin-1");
    expect(
      resolver.impersonatedById({ id: "normal-session" } as Session),
    ).toBeNull();
  });

  it("rejects missing users before revoking their sessions", async () => {
    const { resolver, sessionService } = createResolver({
      revokeSession: vi.fn().mockRejectedValue(new NotFoundException()),
      revokeUserSessions: vi.fn().mockRejectedValue(new NotFoundException()),
    });
    await expect(
      resolver.revokeSession("missing", "session-1"),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(resolver.revokeUserSessions("missing")).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(sessionService.revokeSession).toHaveBeenCalledWith(
      "missing",
      "session-1",
    );
    expect(sessionService.revokeUserSessions).toHaveBeenCalledWith("missing");
  });

  it("delegates administrator-wide session revocation and propagates permission failures", async () => {
    const user = { id: "user-1" } as User;
    const { resolver, sessionService } = createResolver({
      revokeUserSessions: vi.fn(async () => 0),
    });
    await expect(resolver.revokeUserSessions(user.id)).resolves.toBe(true);
    expect(sessionService.revokeUserSessions).toHaveBeenCalledWith(user.id);
    sessionService.revokeUserSessions.mockRejectedValueOnce(
      new ForbiddenException(),
    );
    await expect(resolver.revokeUserSessions(user.id)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("does not change cookies when there is no impersonation to restore", async () => {
    const { resolver, sessionService } = createResolver(
      { setSessionCookie: vi.fn() },
      { stopImpersonating: vi.fn(async () => null) },
    );
    await expect(resolver.stopImpersonating()).resolves.toBeNull();
    expect(sessionService.setSessionCookie).not.toHaveBeenCalled();
  });
  it("returns null when API key authentication has no session", () => {
    const { resolver } = createResolver();

    expect(resolver.currentSession(null)).toBeNull();
  });

  it("delegates session revocation operations", async () => {
    const { resolver, sessionService } = createResolver({
      revokeCurrentUserOtherSessions: vi.fn(async () => true),
      revokeCurrentUserSession: vi.fn(async () => true),
      revokeCurrentUserSessions: vi.fn(async () => true),
    });
    await expect(resolver.revokeCurrentUserSession("session-2")).resolves.toBe(
      true,
    );
    await expect(resolver.revokeCurrentUserOtherSessions()).resolves.toBe(true);
    await expect(resolver.revokeCurrentUserSessions()).resolves.toBe(true);
    expect(sessionService.revokeCurrentUserSession).toHaveBeenCalledWith(
      "session-2",
    );
    expect(
      sessionService.revokeCurrentUserOtherSessions,
    ).toHaveBeenCalledWith();
    expect(sessionService.revokeCurrentUserSessions).toHaveBeenCalledWith();
  });

  it("manages user sessions without exposing missing users", async () => {
    const user = { id: "user-1" } as User;
    const session = {
      id: "session-1",
      token: "token-1",
      expiresAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Session;
    const { resolver, sessionService } = createResolver({
      revokeSession: vi.fn(async () => true),
    });

    await expect(resolver.revokeSession(user.id, session.id)).resolves.toBe(
      true,
    );
    expect(sessionService.revokeSession).toHaveBeenCalledWith(
      user.id,
      session.id,
    );
  });

  it("starts and stops impersonation while selecting each created session", async () => {
    const administrator = { id: "admin-1" } as User;
    const target = { id: "user-1" } as User;
    const { resolver, authService, sessionService } = createResolver(
      {
        setSessionCookie: vi.fn(async () => undefined),
      },
      {
        impersonateUser: vi.fn(async () => target),
        stopImpersonating: vi.fn(async () => administrator),
      },
    );

    await expect(resolver.impersonateUser(target.id)).resolves.toBe(target);
    expect(authService.impersonateUser).toHaveBeenCalledWith(target.id);
    expect(sessionService.setSessionCookie).not.toHaveBeenCalled();

    await expect(resolver.stopImpersonating()).resolves.toBe(administrator);
    expect(authService.stopImpersonating).toHaveBeenCalledWith();
  });
});

function createResolver(
  sessionOverrides: Partial<SessionService> = {},
  authOverrides: Partial<AuthService> = {},
) {
  const sessionService = {
    ...sessionOverrides,
  } as unknown as Mocked<SessionService>;
  const authService = { ...authOverrides } as unknown as Mocked<AuthService>;
  return {
    resolver: new SessionResolver(sessionService, authService),
    sessionService,
    authService,
  };
}
