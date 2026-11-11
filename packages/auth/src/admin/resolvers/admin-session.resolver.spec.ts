import { ForbiddenException, NotFoundException } from "@nestjs/common";
import type { Mocked } from "vitest";

import { type Session } from "../../core/entities/session.entity.js";
import { type User } from "../../core/entities/user.entity.js";
import { type AuthService } from "../../core/services/auth.service.js";
import { type SessionService } from "../../core/services/session.service.js";
import { AdminSessionResolver } from "./admin-session.resolver.js";

describe("AdminSessionResolver", () => {
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
/**
 * Returns test resolver and its mocked dependencies.
 * @param sessionOverrides - Session service methods replaced for this test.
 * @param authOverrides - Authentication service methods replaced for this test.
 * @returns Test resolver and its mocked dependencies.
 */
function createResolver(
  sessionOverrides: Partial<SessionService> = {},
  authOverrides: Partial<AuthService> = {},
) {
  const sessionService = {
    ...sessionOverrides,
  } as unknown as Mocked<SessionService>;
  const authService = { ...authOverrides } as unknown as Mocked<AuthService>;
  return {
    resolver: new AdminSessionResolver(sessionService, authService),
    sessionService,
    authService,
  };
}
