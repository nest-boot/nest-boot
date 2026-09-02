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
import {
  BaseUser,
  BaseWorkspace,
  BaseWorkspaceInvitation,
  BaseWorkspaceMember,
} from "./entities/index.js";
import { WorkspaceService } from "./workspace.service.js";

class TestWorkspace extends BaseWorkspace {
  override id = "workspace-1";
  override name = "Acme";
  override deletedAt: Date | null = null;
}

class TestWorkspaceMember extends BaseWorkspaceMember {
  override id = "member-1";
  override name = "Alice";
  override email: string | null = null;
  override role = "MEMBER" as const;
  override status = "ACTIVE" as const;
  override workspace = {
    id: "workspace-1",
  } as BaseWorkspaceMember["workspace"];
}

class TestUser extends BaseUser {}

class TestWorkspaceInvitation extends BaseWorkspaceInvitation {
  override id = "invitation-1";
  override workspace = {
    id: "workspace-1",
  } as BaseWorkspaceInvitation["workspace"];
}

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
      } as BaseWorkspaceMember["workspace"],
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

  it("lists only non-deleted workspaces for active memberships", async () => {
    const { em, service } = createService();
    const user = new TestUser();
    const activeWorkspace = new TestWorkspace();
    const deletedWorkspace = Object.assign(new TestWorkspace(), {
      deletedAt: new Date(),
      id: "workspace-2",
    });
    em.find.mockResolvedValue([
      Object.assign(new TestWorkspaceMember(), {
        workspace: activeWorkspace,
      }),
      Object.assign(new TestWorkspaceMember(), {
        workspace: deletedWorkspace,
      }),
    ]);

    await expect(service.listWorkspaces(user)).resolves.toEqual([
      activeWorkspace,
    ]);
    expect(em.find).toHaveBeenCalledWith(
      TestWorkspaceMember,
      { status: "ACTIVE", user },
      { filters: false, populate: ["workspace"] },
    );
  });

  it("returns full workspace details split into members and invitations", async () => {
    const { em, service } = createService();
    const workspace = new TestWorkspace();
    const active = new TestWorkspaceMember();
    const disabled = Object.assign(new TestWorkspaceMember(), {
      status: "DISABLED" as const,
    });
    const invitation = new TestWorkspaceInvitation();
    em.find
      .mockResolvedValueOnce([active, disabled])
      .mockResolvedValueOnce([invitation]);

    await expect(service.getFullWorkspace(workspace)).resolves.toEqual({
      invitations: [invitation],
      members: [active, disabled],
      workspace,
    });
  });

  it("adds and updates a workspace member", async () => {
    const { em, service } = createService();
    const workspace = new TestWorkspace();
    const user = Object.assign(new TestUser(), {
      email: "bob@example.com",
      name: "Bob",
    });
    em.findOne.mockResolvedValue(null);

    const member = await service.addMember(workspace, user, {
      permissions: ["project:read"],
      role: "ADMIN",
    });
    expect(member).toEqual(
      expect.objectContaining({
        email: "bob@example.com",
        name: "Bob",
        permissions: ["project:read"],
        role: "ADMIN",
        user,
        workspace,
      }),
    );

    await expect(
      service.updateMember(member, { name: "Robert", status: "DISABLED" }),
    ).resolves.toBe(member);
    expect(member.name).toBe("Robert");
    expect(member.status).toBe("DISABLED");
  });

  it("creates and accepts an email-bound invitation", async () => {
    const { em, service } = createService();
    const workspace = new TestWorkspace();
    const inviter = Object.assign(new TestUser(), {
      email: "owner@example.com",
      name: "Owner",
    });
    const user = Object.assign(new TestUser(), {
      email: "alice@example.com",
      name: "Alice",
    });
    em.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

    const invitation = await service.createInvitation(workspace, inviter, {
      email: "alice@example.com",
      role: "MEMBER",
    });
    expect(invitation.status).toBe("pending");
    expect(invitation.inviter).toBe(inviter);
    expect(invitation.expiresAt).toBeInstanceOf(Date);

    em.findOne.mockResolvedValueOnce(invitation).mockResolvedValueOnce(null);
    await expect(
      service.acceptInvitation(user, invitation.id),
    ).resolves.toEqual({
      invitation,
      member: expect.objectContaining({
        role: "MEMBER",
        status: "ACTIVE",
        user,
      }),
    });
    expect(invitation.status).toBe("accepted");
  });

  it("keeps rejected invitations as separate audit records", async () => {
    const { em, service } = createService();
    const user = Object.assign(new TestUser(), {
      email: "ALICE@example.com",
    });
    const invitation = Object.assign(new TestWorkspaceInvitation(), {
      email: "alice@example.com",
      status: "pending" as const,
    });

    await expect(service.rejectInvitation(user, invitation)).resolves.toBe(
      invitation,
    );
    expect(invitation.status).toBe("rejected");
    expect(em.remove).not.toHaveBeenCalled();
    expect(em.flush).toHaveBeenCalledTimes(1);
  });

  it("does not accept expired or already completed invitations", async () => {
    const { em, service } = createService();
    const user = Object.assign(new TestUser(), {
      email: "alice@example.com",
    });
    const expired = Object.assign(new TestWorkspaceInvitation(), {
      email: user.email,
      expiresAt: new Date(Date.now() - 1),
      status: "pending" as const,
    });
    em.findOne.mockResolvedValueOnce(expired);

    await expect(service.acceptInvitation(user, expired.id)).rejects.toThrow(
      "Workspace invitation has expired",
    );
    expect(expired.status).toBe("pending");
    expect(em.persist).not.toHaveBeenCalled();

    const accepted = Object.assign(new TestWorkspaceInvitation(), {
      email: user.email,
      expiresAt: new Date(Date.now() + 60_000),
      status: "accepted" as const,
    });
    em.findOne.mockResolvedValueOnce(accepted);

    await expect(service.acceptInvitation(user, accepted.id)).rejects.toThrow(
      "Workspace invitation is not pending",
    );
    expect(em.persist).not.toHaveBeenCalled();
  });

  it("protects owners and checks flattened member permissions", async () => {
    const { em, service } = createService();
    const owner = Object.assign(new TestWorkspaceMember(), {
      permissions: ["project:read", "project:update"],
      role: "OWNER" as const,
    });

    await expect(service.removeMember(owner)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(em.remove).not.toHaveBeenCalled();
    expect(
      service.hasPermission(owner, {
        permissions: { project: ["read", "update"] },
      }),
    ).toBe(true);
    expect(
      service.hasPermission(owner, {
        permissions: { project: ["delete"] },
      }),
    ).toBe(false);
  });
});

function createService() {
  const em = {
    assign: vi.fn((entity, data) => Object.assign(entity, data)),
    create: vi.fn((Entity, data) => Object.assign(new Entity(), data)),
    find: vi.fn(),
    findOne: vi.fn(),
    flush: vi.fn(),
    persist: vi.fn(),
    remove: vi.fn(),
  } as unknown as Mocked<EntityManager>;
  em.persist.mockReturnValue(em);
  em.remove.mockReturnValue(em);

  const options = {
    entities: {
      workspace: TestWorkspace,
      workspaceInvitation: TestWorkspaceInvitation,
      workspaceMember: TestWorkspaceMember,
    },
  } as unknown as AuthModuleOptions;

  return {
    em,
    service: new WorkspaceService<
      TestWorkspace,
      TestWorkspaceMember,
      TestWorkspaceInvitation,
      TestUser
    >(em, options),
  };
}
