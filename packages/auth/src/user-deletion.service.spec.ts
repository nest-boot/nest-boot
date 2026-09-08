/* eslint-disable @typescript-eslint/unbound-method */
import { EntityManager, LockMode } from "@mikro-orm/core";
import type { Mocked } from "vitest";

import type { AuthModuleOptions } from "./auth-module-options.interface.js";
import {
  BaseAccount,
  BaseApiKey,
  BaseSession,
  BaseUser,
  BaseVerification,
  BaseWorkspace,
  BaseWorkspaceInvitation,
  BaseWorkspaceMember,
} from "./entities/index.js";
import {
  UserDeletionService,
  WorkspaceOwnershipConflictError,
} from "./user-deletion.service.js";

class TestAccount extends BaseAccount {}
class TestApiKey extends BaseApiKey {}
class TestSession extends BaseSession {}
class TestUser extends BaseUser {}
class TestVerification extends BaseVerification {}
class TestWorkspace extends BaseWorkspace {}
class TestWorkspaceInvitation extends BaseWorkspaceInvitation {}
class TestWorkspaceMember extends BaseWorkspaceMember {}

const entities = {
  account: TestAccount,
  apiKey: TestApiKey,
  session: TestSession,
  user: TestUser,
  verification: TestVerification,
  workspace: TestWorkspace,
  workspaceInvitation: TestWorkspaceInvitation,
  workspaceMember: TestWorkspaceMember,
};

describe("UserDeletionService", () => {
  it("deletes every auth-owned record in one unrestricted transaction", async () => {
    const { em, service } = createService();
    const user = Object.assign(new TestUser(), { id: "user-1" });
    const beforeDelete = vi.fn();
    em.findOne.mockResolvedValue(user);
    em.find.mockResolvedValue([]);

    await expect(service.deleteUser("user-1", beforeDelete)).resolves.toBe(
      user,
    );

    expect(em.transactional).toHaveBeenCalledOnce();
    expect(em.findOne).toHaveBeenCalledWith(
      TestUser,
      { id: "user-1" },
      { filters: false, lockMode: LockMode.PESSIMISTIC_WRITE },
    );
    expect(em.find).toHaveBeenCalledWith(
      TestWorkspaceMember,
      { user },
      {
        filters: false,
        lockMode: LockMode.PESSIMISTIC_WRITE,
        populate: ["workspace"],
      },
    );
    expect(beforeDelete).toHaveBeenCalledOnce();
    expect(em.nativeDelete).toHaveBeenNthCalledWith(1, TestSession, {
      $or: [{ userId: "user-1" }, { impersonatedBy: user }],
    });
    expect(em.nativeDelete).toHaveBeenNthCalledWith(2, TestAccount, {
      userId: "user-1",
    });
    expect(em.nativeDelete).toHaveBeenNthCalledWith(3, TestApiKey, {
      owner: user,
    });
    expect(em.nativeDelete).toHaveBeenNthCalledWith(
      4,
      TestWorkspaceInvitation,
      { inviter: user },
    );
    expect(em.nativeDelete).toHaveBeenNthCalledWith(5, TestWorkspaceMember, {
      user,
    });
    expect(em.remove).toHaveBeenCalledWith(user);
    expect(em.flush).toHaveBeenCalledOnce();
  });

  it("rejects deletion while the user owns an active workspace", async () => {
    const { em, service } = createService();
    const user = Object.assign(new TestUser(), { id: "owner-1" });
    const workspace = Object.assign(new TestWorkspace(), {
      deletedAt: null,
      id: "workspace-1",
    });
    const membership = Object.assign(new TestWorkspaceMember(), {
      roles: ["owner"],
      user,
      workspace,
    });
    const beforeDelete = vi.fn();
    em.findOne.mockResolvedValue(user);
    em.find.mockResolvedValue([membership]);

    await expect(
      service.deleteUser("owner-1", beforeDelete),
    ).rejects.toBeInstanceOf(WorkspaceOwnershipConflictError);

    expect(beforeDelete).not.toHaveBeenCalled();
    expect(em.nativeDelete).not.toHaveBeenCalled();
    expect(em.remove).not.toHaveBeenCalled();
  });

  it("allows deletion after every owned workspace has been deleted", async () => {
    const { em, service } = createService();
    const user = Object.assign(new TestUser(), { id: "owner-1" });
    const workspace = Object.assign(new TestWorkspace(), {
      deletedAt: new Date(),
      id: "workspace-1",
    });
    em.findOne.mockResolvedValue(user);
    em.find.mockResolvedValue([
      Object.assign(new TestWorkspaceMember(), {
        roles: ["owner"],
        user,
        workspace,
      }),
    ]);

    await expect(service.deleteUser("owner-1")).resolves.toBe(user);
    expect(em.remove).toHaveBeenCalledWith(user);
  });
});

function createService() {
  const flush = vi.fn();
  const em = {
    find: vi.fn(),
    findOne: vi.fn(),
    flush,
    nativeDelete: vi.fn(),
    remove: vi.fn(),
    transactional: vi.fn(),
  } as unknown as Mocked<EntityManager>;
  em.remove.mockReturnValue(em);
  em.transactional.mockImplementation(
    async (callback) => await callback(em as never),
  );
  const options = {
    entities,
  } as AuthModuleOptions;

  return {
    em,
    service: new UserDeletionService(em, options),
  };
}
