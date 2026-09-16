/* eslint-disable @typescript-eslint/unbound-method */
import { EntityManager, LockMode } from "@mikro-orm/core";
import type { Mocked } from "vitest";

import type { AuthModuleOptions } from "../auth-module-options.interface.js";
import { Account as AccountEntity } from "../entities/account.entity.js";
import { ApiKey as ApiKeyEntity } from "../entities/api-key.entity.js";
import { Invitation as InvitationEntity } from "../entities/invitation.entity.js";
import {
  Member as BaseMember,
  Member as MemberEntity,
} from "../entities/member.entity.js";
import { Session as SessionEntity } from "../entities/session.entity.js";
import {
  User as BaseUser,
  User as UserEntity,
} from "../entities/user.entity.js";
import { Verification as VerificationEntity } from "../entities/verification.entity.js";
import {
  Workspace as BaseWorkspace,
  Workspace as WorkspaceEntity,
} from "../entities/workspace.entity.js";
import { UserDeletionService } from "./user-deletion.service.js";
const TestUser = BaseUser;
type TestUser = BaseUser;
const TestWorkspace = BaseWorkspace;
type TestWorkspace = BaseWorkspace;
const TestMember = BaseMember;
type TestMember = BaseMember;

const entities = {
  account: AccountEntity,
  apiKey: ApiKeyEntity,
  session: SessionEntity,
  user: UserEntity,
  verification: VerificationEntity,
  workspace: WorkspaceEntity,
  invitation: InvitationEntity,
  member: MemberEntity,
};

describe("UserDeletionService", () => {
  it("deletes only the user and delegates dependant cleanup to foreign keys", async () => {
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
      UserEntity,
      { id: "user-1" },
      { filters: false, lockMode: LockMode.PESSIMISTIC_WRITE },
    );
    expect(em.find).not.toHaveBeenCalled();
    expect(beforeDelete).toHaveBeenCalledOnce();
    expect(em.nativeDelete).toHaveBeenCalledExactlyOnceWith(UserEntity, {
      id: user.id,
    });
    expect(em.remove).not.toHaveBeenCalled();
    expect(em.flush).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    "preserves owned workspaces when deleting a user (scoped: %s)",
    async (scoped) => {
      const { em, service } = createService();
      if (scoped) {
        vi.mocked(em.getContext(false).getSessionContext).mockReturnValue({
          role: "authenticated",
          variables: { "app.user.id": "administrator" },
        });
        em.nativeDelete.mockResolvedValue(1);
      }
      const user = Object.assign(new TestUser(), { id: "owner-1" });
      const workspace = Object.assign(new TestWorkspace(), {
        deletedAt: null,
        id: "workspace-1",
      });
      const membership = Object.assign(new TestMember(), {
        roles: ["owner"],
        user,
        workspace,
      });
      const beforeDelete = vi.fn();
      em.findOne.mockResolvedValue(user);
      em.find.mockResolvedValue([membership]);

      await expect(service.deleteUser("owner-1", beforeDelete)).resolves.toBe(
        user,
      );

      expect(beforeDelete).toHaveBeenCalledOnce();
      expect(em.find).not.toHaveBeenCalled();
      expect(workspace.deletedAt).toBeNull();
      expect(
        em.nativeDelete.mock.calls.some(
          ([entity]) => entity === WorkspaceEntity,
        ),
      ).toBe(false);
      expect(em.remove).not.toHaveBeenCalledWith(workspace);
      expect(em.nativeDelete).toHaveBeenCalledExactlyOnceWith(UserEntity, {
        id: user.id,
      });
      expect(em.remove).not.toHaveBeenCalled();
    },
  );

  it("allows deletion after every owned workspace has been deleted", async () => {
    const { em, service } = createService();
    const user = Object.assign(new TestUser(), { id: "owner-1" });
    const workspace = Object.assign(new TestWorkspace(), {
      deletedAt: new Date(),
      id: "workspace-1",
    });
    em.findOne.mockResolvedValue(user);
    em.find.mockResolvedValue([
      Object.assign(new TestMember(), {
        roles: ["owner"],
        user,
        workspace,
      }),
    ]);

    await expect(service.deleteUser("owner-1")).resolves.toBe(user);
    expect(em.nativeDelete).toHaveBeenCalledExactlyOnceWith(UserEntity, {
      id: user.id,
    });
  });
});

function createService() {
  const flush = vi.fn();
  const em = {
    getContext: vi.fn().mockReturnThis(),
    getSessionContext:
      vi.fn<() => import("@mikro-orm/core").SessionContext | undefined>(),
    isInTransaction: vi.fn(() => false),
    fork: vi.fn(),
    find: vi.fn(),
    findOne: vi.fn(),
    flush,
    nativeDelete: vi.fn().mockResolvedValue(1),
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
