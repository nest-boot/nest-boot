/* eslint-disable @typescript-eslint/unbound-method */
import { EntityManager } from "@mikro-orm/core";
import { ConnectionManager } from "@nest-boot/graphql-connection";
import { RequestContext } from "@nest-boot/request-context";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import type { Mocked } from "vitest";

import { mockRlsContext } from "../../test/mock-rls-context.js";
import { API_KEY } from "../auth.constants.js";
import { SessionConnection } from "../connections/session.connection-definition.js";
import { Session } from "../entities/session.entity.js";
import { User } from "../entities/user.entity.js";
import { WorkspaceApiKey } from "../entities/workspace-api-key.entity.js";
import type { AccessControlService } from "./access-control.service.js";
import { SessionService } from "./session.service.js";

describe("SessionService management", () => {
  it("authorizes administrative revocation before looking up the user", async () => {
    const { em, service, accessControlService } = createService();
    const user = Object.assign(new User(), { id: "target" });
    em.findOne.mockResolvedValue(user);
    em.nativeDelete.mockResolvedValue(2);
    await expect(service.revokeUserSessions(user.id)).resolves.toBe(2);
    expect(accessControlService.assertUserCan).toHaveBeenCalledWith(
      "revoke",
      Session,
    );
    expect(accessControlService.assertUserCan).not.toHaveBeenCalledWith(
      "get",
      User,
    );
    expect(em.findOne).toHaveBeenCalledWith(
      User,
      { id: user.id },
      { refresh: true },
    );

    accessControlService.assertUserCan.mockImplementation(() => {
      throw new ForbiddenException();
    });
    em.findOne.mockClear();
    em.nativeDelete.mockClear();
    await expect(service.revokeUserSessions(user.id)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(service.revokeSession(user.id, "session")).rejects.toThrow(
      ForbiddenException,
    );
    expect(em.findOne).not.toHaveBeenCalled();
    expect(em.nativeDelete).not.toHaveBeenCalled();
  });

  it("rejects missing revocation targets without deleting any sessions", async () => {
    const { em, service } = createService();
    em.findOne.mockResolvedValue(null);
    await expect(service.revokeUserSessions("missing")).rejects.toThrow(
      NotFoundException,
    );
    await expect(service.revokeSession("missing", "session")).rejects.toThrow(
      NotFoundException,
    );
    expect(em.nativeDelete).not.toHaveBeenCalled();
    expect(em.remove).not.toHaveBeenCalled();
  });

  it("preserves session authorization and request RLS for impersonator reads", async () => {
    const { em, service, accessControlService } = createService();
    const user = Object.assign(new User(), { id: "self" });
    const impersonator = Object.assign(new User(), { id: "admin" });
    const session = Object.assign(new Session(), {
      user: { id: user.id },
      impersonatedBy: impersonator,
    });
    const scope = mockRlsContext(em);
    em.findOne.mockResolvedValue(impersonator);
    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      RequestContext.set(User, user);
      await expect(service.getSessionImpersonator(session)).resolves.toBe(
        impersonator,
      );
      expect(em.findOne).toHaveBeenCalledWith(User, { id: "admin" });
      expect(accessControlService.assertUserCan).not.toHaveBeenCalled();
      em.findOne.mockResolvedValue(null);
      await expect(service.getSessionImpersonator(session)).resolves.toBeNull();
      em.findOne.mockClear();
      await expect(
        service.getSessionImpersonator(
          Object.assign(new Session(), { user: { id: user.id } }),
        ),
      ).resolves.toBeNull();
      expect(em.findOne).not.toHaveBeenCalled();
      RequestContext.set(API_KEY, new WorkspaceApiKey());
      accessControlService.assertUserCan.mockImplementation(() => {
        throw new ForbiddenException();
      });
      await expect(service.getSessionImpersonator(session)).rejects.toThrow(
        ForbiddenException,
      );
      expect(em.findOne).not.toHaveBeenCalled();
    });
    expect(em.fork).not.toHaveBeenCalled();
    expect(em.getSessionContext()).toEqual(scope);
  });

  it("paginates own sessions without admin permission, but checks delegated and foreign access", async () => {
    const { service, em, accessControlService } = createService();
    const user = Object.assign(new User(), { id: "self" });
    const context = mockRlsContext(em);
    const result = { edges: [], pageInfo: {} };
    const find = vi
      .spyOn(ConnectionManager.prototype, "find")
      .mockResolvedValue(result as never);
    try {
      await RequestContext.run(
        new RequestContext({ type: "test" }),
        async () => {
          RequestContext.set(User, user);
          await expect(
            service.getSessionConnectionByUser(user, { first: 2 }),
          ).resolves.toBe(result);
          expect(accessControlService.assertUserCan).not.toHaveBeenCalled();
          expect(find).toHaveBeenCalledWith(
            SessionConnection,
            { first: 2 },
            {
              where: { user: "self", expiresAt: { $gt: expect.any(Date) } },
              exclude: ["token"],
            },
          );
          expect(em.fork).not.toHaveBeenCalled();
          expect(em.getSessionContext()).toEqual(context);
          vi.mocked(accessControlService.assertUserCan).mockImplementation(
            () => {
              throw new ForbiddenException();
            },
          );
          await expect(
            service.getSessionConnectionByUser(
              Object.assign(new User(), { id: "other" }),
              { first: 2 },
            ),
          ).rejects.toThrow(ForbiddenException);
          RequestContext.set(API_KEY, new WorkspaceApiKey());
          await expect(
            service.getSessionConnectionByUser(user, { first: 2 }),
          ).rejects.toThrow(ForbiddenException);
        },
      );
    } finally {
      find.mockRestore();
    }
  });

  it("revokes user sessions", async () => {
    const { em, service } = createService();
    const user = Object.assign(new User(), { id: "user-1" });
    const session = Object.assign(new Session(), {
      id: "session-1",
      token: "session-token",
      user,
    });
    em.findOne.mockResolvedValue(session);
    em.nativeDelete.mockResolvedValue(2);

    await expect(service.revokeSession(user, session.id)).resolves.toBe(true);
    em.findOne.mockResolvedValueOnce(null);
    await expect(service.revokeSession(user, "missing")).resolves.toBe(false);
    await expect(service.revokeUserSessions(user)).resolves.toBe(2);

    expect(em.findOne).toHaveBeenCalledWith(
      Session,
      { id: session.id, user: "user-1" },
      { filters: false },
    );
    expect(em.remove).toHaveBeenCalledWith(session);
    expect(em.nativeDelete).toHaveBeenCalledWith(Session, {
      $or: [{ user: "user-1" }, { impersonatedBy: user }],
    });
  });
});
function createService() {
  const em = {
    getContext: vi.fn().mockReturnThis(),
    getSessionContext:
      vi.fn<() => import("@mikro-orm/core").SessionContext | undefined>(),
    isInTransaction: vi.fn(() => false),
    fork: vi.fn(),
    find: vi.fn(),
    findOne: vi.fn(),
    flush: vi.fn(),
    nativeDelete: vi.fn(),
    remove: vi.fn(),
    transactional: vi.fn(),
  } as unknown as Mocked<EntityManager>;
  em.remove.mockReturnValue(em);
  em.transactional.mockImplementation(async (callback) => await callback(em));
  const accessControlService = {
    assertUserCan: vi.fn(),
  } as unknown as Mocked<AccessControlService>;
  return {
    em,
    accessControlService,
    service: new SessionService({}, em, accessControlService),
  };
}
