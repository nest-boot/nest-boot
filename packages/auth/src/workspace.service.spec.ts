/* eslint-disable @typescript-eslint/unbound-method */
import { EntityManager } from "@mikro-orm/core";
import { RequestContext } from "@nest-boot/request-context";
import {
  RowLevelSecurity,
  RowLevelSecurityMode,
} from "@nest-boot/row-level-security";
import { ForbiddenException } from "@nestjs/common";
import type { Mocked } from "vitest";

import type { AuthModuleOptions } from "./auth-module-options.interface.js";
import { BaseUser } from "./entities/user.entity.js";
import type {
  AuthWorkspaceEntity,
  AuthWorkspaceMemberEntity,
} from "./interfaces/auth-entities.interface.js";
import { WorkspaceService } from "./workspace.service.js";

class TestWorkspace implements AuthWorkspaceEntity {
  id = "workspace-1";
  name = "Acme";
  deletedAt: Date | null = null;
}

class TestWorkspaceMember implements AuthWorkspaceMemberEntity {
  id = "member-1";
  name = "Alice";
  email: string | null = null;
  role = "MEMBER" as const;
  status = "ACTIVE" as const;
  workspace = { id: "workspace-1" } as AuthWorkspaceMemberEntity["workspace"];
}

class TestUser extends BaseUser {}

describe("WorkspaceService", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a workspace and its owner membership atomically", async () => {
    const { em, service } = createService();
    const user = Object.assign(new TestUser(), {
      email: "alice@example.com",
      name: "Alice",
    });

    const workspace = await service.createWorkspace(user, { name: "Acme" });

    expect(em.create).toHaveBeenNthCalledWith(1, TestWorkspace, {
      name: "Acme",
    });
    expect(em.create).toHaveBeenNthCalledWith(
      2,
      TestWorkspaceMember,
      expect.objectContaining({
        email: "alice@example.com",
        name: "Alice",
        role: "OWNER",
        status: "ACTIVE",
        user,
        workspace,
      }),
    );
    expect(em.persist).toHaveBeenCalledTimes(2);
    expect(em.flush).toHaveBeenCalledTimes(1);
  });

  it("updates mutable workspace fields", async () => {
    const { em, service } = createService();
    const workspace = new TestWorkspace();

    await expect(
      service.updateWorkspace(workspace, { name: "Renamed" }),
    ).resolves.toBe(workspace);

    expect(em.assign).toHaveBeenCalledWith(workspace, { name: "Renamed" });
    expect(em.flush).toHaveBeenCalledTimes(1);
  });

  it("only lets owners soft-delete workspaces", async () => {
    const { em, service } = createService();
    const workspace = new TestWorkspace();
    const member = new TestWorkspaceMember();

    await expect(
      service.deleteWorkspace(workspace, member),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(em.flush).not.toHaveBeenCalled();
  });

  it("does not let an owner delete a different workspace", async () => {
    const { em, service } = createService();
    const owner = Object.assign(new TestWorkspaceMember(), {
      role: "OWNER" as const,
      workspace: {
        id: "workspace-2",
      } as AuthWorkspaceMemberEntity["workspace"],
    });

    await expect(
      service.deleteWorkspace(new TestWorkspace(), owner),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(em.flush).not.toHaveBeenCalled();
  });

  it("disables RLS only inside the workspace deletion context", async () => {
    const { em, service } = createService();
    const workspace = new TestWorkspace();
    const owner = Object.assign(new TestWorkspaceMember(), {
      role: "OWNER" as const,
    });
    em.assign.mockImplementation((entity, data) => {
      expect(RowLevelSecurity.getMode()).toBe(RowLevelSecurityMode.DISABLED);
      Object.assign(entity, data);
      return entity;
    });
    em.flush.mockImplementation(() => {
      expect(RowLevelSecurity.getMode()).toBe(RowLevelSecurityMode.DISABLED);
      return Promise.resolve();
    });

    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      RowLevelSecurity.setMode(RowLevelSecurityMode.ENABLED);
      await expect(service.deleteWorkspace(workspace, owner)).resolves.toBe(
        workspace,
      );
      expect(RowLevelSecurity.getMode()).toBe(RowLevelSecurityMode.ENABLED);
    });

    expect(workspace.deletedAt).toBeInstanceOf(Date);
  });
});

function createService() {
  const em = {
    assign: vi.fn((entity, data) => Object.assign(entity, data)),
    create: vi.fn((_entity, data) => data),
    findOne: vi.fn(),
    flush: vi.fn(),
    persist: vi.fn(),
  } as unknown as Mocked<EntityManager>;
  em.persist.mockReturnValue(em);

  const options = {
    entities: {
      workspace: TestWorkspace,
      workspaceMember: TestWorkspaceMember,
    },
  } as unknown as AuthModuleOptions;

  return {
    em,
    service: new WorkspaceService<TestWorkspace, TestWorkspaceMember, TestUser>(
      em,
      options,
    ),
  };
}
