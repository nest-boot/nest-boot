/* eslint-disable @typescript-eslint/unbound-method */
import { EntityManager, LockMode } from "@mikro-orm/core";
import { RequestContext } from "@nest-boot/request-context";
import {
  RowLevelSecurity,
  RowLevelSecurityMode,
} from "@nest-boot/row-level-security";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import type { Mocked } from "vitest";

import type { AuthModuleOptions } from "./auth-module-options.interface.js";
import type { AuthorizationService } from "./authorization.service.js";
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

  it("fails before persistence when a service-level permission is denied", async () => {
    const { authorizationService, em, service } = createService();
    vi.mocked(authorizationService.assertWorkspaceCan).mockImplementation(
      () => {
        throw new ForbiddenException();
      },
    );

    await expect(
      service.updateWorkspace(new TestWorkspace(), { name: "Denied" }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(em.assign).not.toHaveBeenCalled();
    expect(em.flush).not.toHaveBeenCalled();
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
        roles: ["owner"],
        status: "ACTIVE",
        user,
        workspace,
      }),
    );
    expect(em.persist).toHaveBeenCalledTimes(2);
    expect(em.flush).toHaveBeenCalledTimes(1);
  });

  it("uses configured creator and default member roles", async () => {
    const { em, service } = createService({
      creatorRole: "founder",
      defaultRole: "viewer",
      permissions: [],
      roles: { founder: [], viewer: [] },
    });
    const user = Object.assign(new TestUser(), {
      email: "alice@example.com",
      name: "Alice",
    });

    await service.createWorkspace(user, { name: "Acme" });
    em.findOne.mockResolvedValueOnce(null);
    await service.addMember(new TestWorkspace(), user);

    expect(em.create).toHaveBeenNthCalledWith(
      2,
      TestWorkspaceMember,
      expect.objectContaining({ roles: ["founder"] }),
    );
    expect(em.create).toHaveBeenNthCalledWith(
      3,
      TestWorkspaceMember,
      expect.objectContaining({ roles: ["viewer"] }),
    );
    expect(
      service.getMemberPermissions(
        Object.assign(new TestWorkspaceMember(), { roles: undefined }),
      ),
    ).toEqual([]);
  });

  it("adds a member by normalized email inside the workspace permission boundary", async () => {
    const { authorizationService, em, service } = createService();
    const workspace = new TestWorkspace();
    const user = Object.assign(new TestUser(), {
      email: "alice@example.com",
      name: "Alice",
    });
    em.findOne.mockResolvedValueOnce(user).mockResolvedValueOnce(null);

    await expect(
      service.addMemberByEmail(workspace, " Alice@Example.com "),
    ).resolves.toEqual(expect.objectContaining({ user, workspace }));

    expect(em.findOne).toHaveBeenNthCalledWith(
      1,
      TestUser,
      { email: "alice@example.com" },
      { filters: false },
    );
    expect(authorizationService.assertWorkspaceCan).toHaveBeenCalledWith(
      "create",
      TestWorkspaceMember,
    );
  });

  it("uses the configured default role for invitations", async () => {
    const { em, service } = createService({
      creatorRole: "founder",
      defaultRole: "viewer",
      permissions: [],
      roles: { founder: [], viewer: [] },
    });
    const workspace = new TestWorkspace();
    const inviter = Object.assign(new TestUser(), {
      email: "owner@example.com",
      name: "Owner",
    });
    em.findOne.mockResolvedValue(null);

    const invitation = await service.createInvitation(workspace, inviter, {
      email: "alice@example.com",
    });

    expect(invitation.roles).toEqual(["viewer"]);
    expect(em.create).toHaveBeenCalledWith(
      TestWorkspaceInvitation,
      expect.objectContaining({ roles: ["viewer"] }),
    );
  });

  it("uses the configured creator role for owner invariants", async () => {
    const { service } = createService({
      creatorRole: "founder",
      defaultRole: "viewer",
      permissions: [],
      roles: { founder: [], viewer: [] },
    });
    const workspace = new TestWorkspace();
    const founder = Object.assign(new TestWorkspaceMember(), {
      roles: ["founder"],
      workspace,
    });
    const builtInOwner = Object.assign(new TestWorkspaceMember(), {
      roles: ["owner"],
      workspace,
    });

    await expect(service.deleteWorkspace(workspace, founder)).resolves.toBe(
      workspace,
    );
    await expect(
      service.deleteWorkspace(workspace, builtInOwner),
    ).rejects.toBeInstanceOf(ForbiddenException);
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
      roles: ["owner"],
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
      roles: ["owner"],
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
      permissions: ["workspace:update"],
      roles: ["admin"],
    });
    expect(member).toEqual(
      expect.objectContaining({
        email: "bob@example.com",
        name: "Bob",
        permissions: ["workspace:update"],
        roles: ["admin"],
        user,
        workspace,
      }),
    );

    await expect(
      service.updateMember(member, { name: "Robert", status: "DISABLED" }),
    ).resolves.toBe(member);
    expect(member.name).toBe("Robert");
    expect(member.status).toBe("DISABLED");
    await expect(
      service.updateMember(member, { roles: ["member"] } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects assigning the creator role outside ownership transfer", async () => {
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
    em.findOne.mockResolvedValue(null);

    await expect(
      service.addMember(workspace, user, { roles: ["owner"] }),
    ).rejects.toThrow(
      "The owner role can only be assigned by transferring ownership",
    );
    await expect(
      service.createInvitation(workspace, inviter, {
        email: user.email,
        roles: ["owner"],
      }),
    ).rejects.toThrow(
      "The owner role can only be assigned by transferring ownership",
    );

    const invitation = Object.assign(new TestWorkspaceInvitation(), {
      email: user.email,
      expiresAt: new Date(Date.now() + 60_000),
      roles: ["owner"],
      status: "pending" as const,
      workspace,
    });
    em.findOne.mockReset();
    em.findOne.mockResolvedValueOnce(invitation).mockResolvedValueOnce(null);
    await expect(service.acceptInvitation(user, invitation.id)).rejects.toThrow(
      "The owner role can only be assigned by transferring ownership",
    );
  });

  it("validates direct member permissions against the workspace catalog", async () => {
    const { em, service } = createService();
    const workspace = new TestWorkspace();
    const user = new TestUser();
    em.findOne.mockResolvedValue(null);

    await expect(
      service.addMember(workspace, user, {
        permissions: ["user:get"],
      }),
    ).rejects.toThrow(
      "Workspace member contains unknown permissions: user:get",
    );

    const member = new TestWorkspaceMember();
    await expect(
      service.setMemberPermissions(member, [
        "workspace:update",
        "workspace:update",
      ]),
    ).rejects.toThrow(
      "Workspace member contains duplicate permissions: workspace:update",
    );
    await expect(
      service.setMemberPermissions(member, ["workspace:update"]),
    ).resolves.toBe(member);
    expect(member.permissions).toEqual(["workspace:update"]);
  });

  it("lists configured roles and updates member roles", async () => {
    const { service } = createService({
      permissions: [
        "workspace:update",
        "workspaceMember:update",
        "workspace:delete",
        "workspaceInvitation:cancel",
      ],
      roles: {
        admin: ["workspace:update", "workspaceMember:update"],
        member: [],
        owner: ["workspace:delete"],
      },
    });
    const member = Object.assign(new TestWorkspaceMember(), {
      permissions: ["workspaceInvitation:create"],
      roles: ["member"],
    });

    expect(service.listRoles()).toEqual([
      {
        name: "admin",
        permissions: ["workspace:update", "workspaceMember:update"],
      },
      { name: "member", permissions: [] },
      { name: "owner", permissions: ["workspace:delete"] },
    ]);
    expect(service.listPermissions()).toEqual([
      "workspace:update",
      "workspaceMember:update",
      "workspace:delete",
      "workspaceInvitation:cancel",
    ]);

    await expect(service.updateMemberRole(member, ["admin"])).resolves.toBe(
      member,
    );
    expect(member.roles).toEqual(["admin"]);
    expect(service.getMemberPermissions(member)).toEqual([
      "workspace:update",
      "workspaceMember:update",
      "workspaceInvitation:create",
    ]);
    await expect(
      service.updateMemberRole(member, ["missing"]),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.updateMemberRole(member, ["owner"]),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("finds members by workspace and identifier", async () => {
    const { em, service } = createService();
    const workspace = new TestWorkspace();
    const member = new TestWorkspaceMember();
    em.findOne.mockResolvedValue(member);

    await expect(service.getMemberById(workspace, member.id)).resolves.toBe(
      member,
    );
    expect(em.findOne).toHaveBeenCalledWith(
      TestWorkspaceMember,
      { id: member.id, workspace },
      { filters: false },
    );
  });

  it("transfers workspace ownership atomically", async () => {
    const { em, service } = createService();
    const workspace = new TestWorkspace();
    const currentOwner = Object.assign(new TestWorkspaceMember(), {
      roles: ["owner"],
      workspace,
    });
    const nextOwner = Object.assign(new TestWorkspaceMember(), {
      id: "member-2",
      roles: ["admin"],
      workspace,
    });

    await expect(
      service.transferOwnership(workspace, currentOwner, nextOwner),
    ).resolves.toBe(nextOwner);

    expect(em.lock).toHaveBeenNthCalledWith(
      1,
      currentOwner,
      LockMode.PESSIMISTIC_WRITE,
    );
    expect(em.lock).toHaveBeenNthCalledWith(
      2,
      nextOwner,
      LockMode.PESSIMISTIC_WRITE,
    );
    expect(currentOwner.roles).toEqual(["member"]);
    expect(nextOwner.roles).toEqual(["owner"]);
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
      roles: ["member"],
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
        roles: ["member"],
        status: "ACTIVE",
        user,
      }),
    });
    expect(invitation.status).toBe("accepted");
  });

  it("sends the configured invitation email after persisting the invitation", async () => {
    const sendInvitationEmail = vi.fn().mockResolvedValue(undefined);
    const { em, service } = createService({ sendInvitationEmail });
    const workspace = new TestWorkspace();
    const inviter = Object.assign(new TestUser(), {
      email: "owner@example.com",
      name: "Owner",
    });
    const inviterMember = Object.assign(new TestWorkspaceMember(), {
      email: inviter.email,
      name: inviter.name,
      roles: ["owner"],
      user: inviter,
      workspace,
    });
    const request = new Request("https://app.example.com/invitations");
    em.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(inviterMember);

    const invitation = await service.createInvitation(
      workspace,
      inviter,
      {
        email: "INVITED@example.com",
        roles: ["admin"],
      },
      request,
    );

    expect(sendInvitationEmail).toHaveBeenCalledWith(
      {
        email: "invited@example.com",
        id: invitation.id,
        invitation,
        inviter: expect.objectContaining({
          id: inviterMember.id,
          roles: ["owner"],
          user: inviter,
        }),
        roles: ["admin"],
        workspace,
      },
      request,
    );
    expect(em.flush.mock.invocationCallOrder[0]).toBeLessThan(
      sendInvitationEmail.mock.invocationCallOrder[0],
    );
  });

  it("gets and lists workspace and current-user invitations", async () => {
    const { em, service } = createService();
    const workspace = new TestWorkspace();
    const user = Object.assign(new TestUser(), {
      email: "ALICE@example.com",
    });
    const invitation = Object.assign(new TestWorkspaceInvitation(), {
      email: "alice@example.com",
    });
    em.findOne.mockResolvedValue(invitation);
    em.find
      .mockResolvedValueOnce([invitation])
      .mockResolvedValueOnce([invitation]);

    await expect(service.getUserInvitation(invitation.id, user)).resolves.toBe(
      invitation,
    );
    await expect(
      service.getWorkspaceInvitation(invitation.id, workspace),
    ).resolves.toBe(invitation);
    await expect(service.listInvitations(workspace)).resolves.toEqual([
      invitation,
    ]);
    await expect(service.listUserInvitations(user)).resolves.toEqual([
      invitation,
    ]);

    expect(em.findOne).toHaveBeenCalledWith(
      TestWorkspaceInvitation,
      { email: "alice@example.com", id: invitation.id },
      { filters: false },
    );
    expect(em.findOne).toHaveBeenCalledWith(
      TestWorkspaceInvitation,
      { id: invitation.id, workspace },
      { filters: false },
    );
    expect(em.find).toHaveBeenNthCalledWith(
      1,
      TestWorkspaceInvitation,
      { workspace },
      { filters: false, orderBy: { createdAt: "desc" } },
    );
    expect(em.find).toHaveBeenNthCalledWith(
      2,
      TestWorkspaceInvitation,
      {
        email: "alice@example.com",
        expiresAt: { $gt: expect.any(Date) },
        status: "pending",
      },
      { filters: false, orderBy: { createdAt: "desc" } },
    );
  });

  it("ignores expired pending invitations when creating a replacement", async () => {
    const { em, service } = createService();
    const workspace = new TestWorkspace();
    const inviter = Object.assign(new TestUser(), {
      email: "owner@example.com",
      name: "Owner",
    });
    const expired = Object.assign(new TestWorkspaceInvitation(), {
      email: "alice@example.com",
      expiresAt: new Date(Date.now() - 60_000),
      status: "pending" as const,
      workspace,
    });
    em.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(expired);

    await expect(
      service.createInvitation(workspace, inviter, {
        email: "alice@example.com",
      }),
    ).resolves.toBeInstanceOf(TestWorkspaceInvitation);
    expect(em.findOne).toHaveBeenNthCalledWith(
      2,
      TestWorkspaceInvitation,
      {
        email: "alice@example.com",
        status: "pending",
        workspace,
      },
      { filters: false },
    );
    expect(expired.status).toBe("canceled");
  });

  it("cancels a pending invitation while retaining its lifecycle record", async () => {
    const { em, service } = createService();
    const invitation = Object.assign(new TestWorkspaceInvitation(), {
      status: "pending" as const,
    });

    await expect(service.cancelInvitation(invitation)).resolves.toBe(
      invitation,
    );

    expect(invitation.status).toBe("canceled");
    expect(em.remove).not.toHaveBeenCalled();
    expect(em.flush).toHaveBeenCalledTimes(1);
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
      roles: ["owner"],
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

function createService(
  workspace: NonNullable<AuthModuleOptions["workspace"]> = {},
) {
  const em = {
    assign: vi.fn((entity, data) => Object.assign(entity, data)),
    create: vi.fn((Entity, data) => Object.assign(new Entity(), data)),
    find: vi.fn(),
    findOne: vi.fn(),
    flush: vi.fn(),
    lock: vi.fn(),
    persist: vi.fn(),
    remove: vi.fn(),
    transactional: vi.fn(),
  } as unknown as Mocked<EntityManager>;
  em.persist.mockReturnValue(em);
  em.remove.mockReturnValue(em);
  em.transactional.mockImplementation(async (callback) => await callback(em));

  const options = {
    entities: {
      user: TestUser,
      workspace: TestWorkspace,
      workspaceInvitation: TestWorkspaceInvitation,
      workspaceMember: TestWorkspaceMember,
    },
    workspace,
  } as unknown as AuthModuleOptions;
  const authorizationService = {
    assertCurrentUser: vi.fn(),
    assertCurrentWorkspaceMember: vi.fn(),
    assertUserCan: vi.fn(),
    assertWorkspaceCan: vi.fn(),
  } as unknown as AuthorizationService;
  return {
    authorizationService,
    em,
    service: new WorkspaceService<
      TestWorkspace,
      TestWorkspaceMember,
      TestWorkspaceInvitation,
      TestUser
    >(em, options, authorizationService),
  };
}
