import { ForbiddenException } from "@nestjs/common";
import { MODULE_METADATA } from "@nestjs/common/constants";
import type { Mocked } from "vitest";

import { AuthModule } from "../auth.module.js";
import { type Session } from "../entities/session.entity.js";
import { type User } from "../entities/user.entity.js";
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
});
/**
 *
 * @param sessionOverrides - Session methods replaced for this test.
 * @returns Resolver and its mocked dependencies.
 */
function createResolver(sessionOverrides: Partial<SessionService> = {}) {
  const sessionService = sessionOverrides as Mocked<SessionService>;
  return { sessionService, resolver: new SessionResolver(sessionService) };
}
