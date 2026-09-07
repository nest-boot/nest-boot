/* eslint-disable @typescript-eslint/unbound-method */
import {
  EntityManager,
  LockMode,
  UniqueConstraintViolationException,
} from "@mikro-orm/core";
import { RequestContext } from "@nest-boot/request-context";
import {
  RowLevelSecurity,
  RowLevelSecurityMode,
} from "@nest-boot/row-level-security";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import type { Mocked } from "vitest";

import type { AccessControlService } from "./access-control.service.js";
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

  it("fails before persistence when a service-level permission is denied", async () => {
    const { accessControlService, em, service } = createService();
    vi.mocked(accessControlService.assertWorkspaceCan).mockImplementation(
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
    const { accessControlService, em, service } = createService();
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
    expect(accessControlService.assertWorkspaceCan).toHaveBeenCalledWith(
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
    const { accessControlService, em, service } = createService();
    const workspace = new TestWorkspace();

    await expect(
      service.updateWorkspace(workspace, { name: "Renamed" }),
    ).resolves.toBe(workspace);

    expect(em.assign).toHaveBeenCalledWith(workspace, { name: "Renamed" });
    expect(em.flush).toHaveBeenCalledTimes(1);
    expect(accessControlService.assertCurrentWorkspace).toHaveBeenCalledWith(
      workspace,
    );
  });

  it("rejects workspace resources outside the selected request context", async () => {
    const { accessControlService, em, service } = createService();
    const workspace = new TestWorkspace();
    vi.mocked(accessControlService.assertCurrentWorkspace).mockImplementation(
      () => {
        throw new ForbiddenException();
      },
    );

    await expect(service.listMembers(workspace)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(em.find).not.toHaveBeenCalled();
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
    expect(em.nativeUpdate).toHaveBeenCalledWith(
      TestWorkspaceInvitation,
      { status: "pending", workspace },
      { status: "canceled" },
    );
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

  it("finds workspaces and memberships through the public lookup APIs", async () => {
    const { em, service } = createService();
    const workspace = new TestWorkspace();
    const user = new TestUser();
    const member = Object.assign(new TestWorkspaceMember(), { workspace });
    em.findOne.mockResolvedValueOnce(workspace).mockResolvedValueOnce(member);
    em.find.mockResolvedValue([member]);

    await expect(service.findOne({ id: workspace.id })).resolves.toBe(
      workspace,
    );
    await expect(service.getMember(workspace, user)).resolves.toBe(member);
    await expect(service.listMembers(workspace)).resolves.toEqual([member]);

    expect(em.findOne).toHaveBeenNthCalledWith(1, TestWorkspace, {
      id: workspace.id,
    });
    expect(em.findOne).toHaveBeenNthCalledWith(
      2,
      TestWorkspaceMember,
      { status: "ACTIVE", user, workspace },
      { filters: false },
    );
    expect(em.find).toHaveBeenCalledWith(
      TestWorkspaceMember,
      { status: { $in: ["ACTIVE", "DISABLED"] }, workspace },
      { filters: false, orderBy: { createdAt: "asc" } },
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
      permissions: ["Workspace:update"],
      roles: ["admin"],
    });
    expect(member).toEqual(
      expect.objectContaining({
        email: "bob@example.com",
        name: "Bob",
        permissions: ["Workspace:update"],
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

  it("rejects a member email already used in the workspace", async () => {
    const { em, service } = createService();
    const workspace = new TestWorkspace();
    const member = Object.assign(new TestWorkspaceMember(), { workspace });
    const duplicate = Object.assign(new TestWorkspaceMember(), {
      id: "member-2",
      workspace,
    });
    em.findOne.mockResolvedValue(duplicate);

    await expect(
      service.updateMember(member, { email: " Duplicate@Example.com " }),
    ).rejects.toThrow("A workspace member already uses this email address");
    expect(em.findOne).toHaveBeenCalledWith(
      TestWorkspaceMember,
      {
        email: "duplicate@example.com",
        id: { $ne: member.id },
        workspace,
      },
      { filters: false },
    );
    expect(em.assign).not.toHaveBeenCalled();
  });

  it("rejects duplicate members, missing users, and owner mutations", async () => {
    const { em, service } = createService();
    const workspace = new TestWorkspace();
    const user = Object.assign(new TestUser(), {
      email: "alice@example.com",
    });
    const member = Object.assign(new TestWorkspaceMember(), {
      user,
      workspace,
    });
    em.findOne.mockResolvedValueOnce(member);

    await expect(service.addMember(workspace, user)).rejects.toThrow(
      "User is already a member",
    );

    em.findOne.mockReset();
    em.findOne.mockResolvedValueOnce(null);
    await expect(
      service.addMemberByEmail(workspace, "missing@example.com"),
    ).rejects.toThrow("User not found");

    const owner = Object.assign(new TestWorkspaceMember(), {
      roles: ["owner"],
      workspace,
    });
    await expect(service.updateMemberRole(owner, ["admin"])).rejects.toThrow(
      "Workspace owner roles can only be changed by transferring ownership",
    );
    await expect(service.leaveWorkspace(owner)).rejects.toThrow(
      "Workspace owners cannot leave",
    );
  });

  it("creates service accounts through the auth workspace service", async () => {
    const { em, service } = createService();
    const workspace = new TestWorkspace();

    const member = await service.createServiceAccount(workspace, {
      data: { type: "SERVICE_ACCOUNT" },
      name: "Deploy Bot",
      permissions: ["Workspace:update"],
      roles: ["admin"],
    });

    expect(em.create).toHaveBeenCalledWith(
      TestWorkspaceMember,
      expect.objectContaining({
        email: null,
        name: "Deploy Bot",
        permissions: ["Workspace:update"],
        roles: ["admin"],
        status: "ACTIVE",
        type: "SERVICE_ACCOUNT",
        user: null,
        workspace,
      }),
    );
    expect(member).toEqual(expect.objectContaining({ name: "Deploy Bot" }));
  });

  it("does not allow disabling a workspace owner", async () => {
    const { service } = createService();
    const owner = Object.assign(new TestWorkspaceMember(), {
      roles: ["owner"],
    });

    await expect(
      service.updateMember(owner, { status: "DISABLED" }),
    ).rejects.toBeInstanceOf(ForbiddenException);
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
    const { accessControlService, em, service } = createService();
    const workspace = new TestWorkspace();
    const user = new TestUser();
    em.findOne.mockResolvedValue(null);

    await expect(
      service.addMember(workspace, user, {
        permissions: ["User:get"],
      }),
    ).rejects.toThrow(
      "Workspace member contains unknown permissions: User:get",
    );

    const member = new TestWorkspaceMember();
    await expect(
      service.setMemberPermissions(member, [
        "Workspace:update",
        "Workspace:update",
      ]),
    ).rejects.toThrow(
      "Workspace member contains duplicate permissions: Workspace:update",
    );
    await expect(
      service.setMemberPermissions(member, ["Workspace:update"]),
    ).resolves.toBe(member);
    expect(member.permissions).toEqual(["Workspace:update"]);
    expect(
      accessControlService.assertCanGrantWorkspacePermissions,
    ).toHaveBeenCalledWith(["Workspace:update"]);
  });

  it("checks role grants against the issuer permission ceiling", async () => {
    const { accessControlService, service } = createService();
    const member = Object.assign(new TestWorkspaceMember(), {
      roles: ["member"],
    });

    await service.updateMemberRole(member, ["admin"]);

    expect(
      accessControlService.assertCanGrantWorkspacePermissions,
    ).toHaveBeenCalledWith(
      expect.arrayContaining(["Workspace:update", "WorkspaceMember:create"]),
    );
  });

  it("lists configured roles and updates member roles", async () => {
    const { service } = createService({
      permissions: [
        "Workspace:update",
        "WorkspaceMember:update",
        "Workspace:delete",
        "WorkspaceInvitation:cancel",
      ],
      roles: {
        admin: ["Workspace:update", "WorkspaceMember:update"],
        member: [],
        owner: ["Workspace:delete"],
      },
    });
    const member = Object.assign(new TestWorkspaceMember(), {
      permissions: ["WorkspaceInvitation:create"],
      roles: ["member"],
    });

    expect(service.listRoles()).toEqual([
      {
        name: "admin",
        permissions: ["Workspace:update", "WorkspaceMember:update"],
      },
      { name: "member", permissions: [] },
      { name: "owner", permissions: ["Workspace:delete"] },
    ]);
    expect(service.listPermissions()).toEqual([
      "Workspace:update",
      "WorkspaceMember:update",
      "Workspace:delete",
      "WorkspaceInvitation:cancel",
    ]);

    await expect(service.updateMemberRole(member, ["admin"])).resolves.toBe(
      member,
    );
    expect(member.roles).toEqual(["admin"]);
    expect(service.getMemberPermissions(member)).toEqual([
      "Workspace:update",
      "WorkspaceMember:update",
      "WorkspaceInvitation:create",
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
      user: new TestUser(),
      workspace,
    });
    em.findOne
      .mockResolvedValueOnce(currentOwner)
      .mockResolvedValueOnce(nextOwner);

    await expect(
      service.transferOwnership(workspace, currentOwner, nextOwner),
    ).resolves.toBe(nextOwner);

    expect(em.findOne).toHaveBeenNthCalledWith(
      1,
      TestWorkspaceMember,
      { id: currentOwner.id, workspace },
      { filters: false, lockMode: LockMode.PESSIMISTIC_WRITE },
    );
    expect(em.findOne).toHaveBeenNthCalledWith(
      2,
      TestWorkspaceMember,
      { id: nextOwner.id, workspace },
      { filters: false, lockMode: LockMode.PESSIMISTIC_WRITE },
    );
    expect(currentOwner.roles).toEqual(["member"]);
    expect(nextOwner.roles).toEqual(["owner"]);
  });

  it("does not transfer ownership to a service account", async () => {
    const { em, service } = createService();
    const workspace = new TestWorkspace();
    const currentOwner = Object.assign(new TestWorkspaceMember(), {
      roles: ["owner"],
      user: new TestUser(),
      workspace,
    });
    const serviceAccount = Object.assign(new TestWorkspaceMember(), {
      id: "member-2",
      roles: ["admin"],
      user: null,
      workspace,
    });

    await expect(
      service.transferOwnership(workspace, currentOwner, serviceAccount),
    ).rejects.toThrow("another active user member");
    expect(em.findOne).not.toHaveBeenCalled();
  });

  it("rejects stale ownership state after locking transfer participants", async () => {
    const { em, service } = createService();
    const workspace = new TestWorkspace();
    const currentOwner = Object.assign(new TestWorkspaceMember(), {
      roles: ["owner"],
      user: new TestUser(),
      workspace,
    });
    const nextOwner = Object.assign(new TestWorkspaceMember(), {
      id: "member-2",
      roles: ["admin"],
      user: new TestUser(),
      workspace,
    });

    em.findOne.mockResolvedValueOnce(null);
    await expect(
      service.transferOwnership(workspace, currentOwner, nextOwner),
    ).rejects.toThrow("Workspace ownership has already changed");

    em.findOne.mockReset();
    em.findOne
      .mockResolvedValueOnce(
        Object.assign(new TestWorkspaceMember(), {
          roles: ["member"],
          workspace,
        }),
      )
      .mockResolvedValueOnce(nextOwner);
    await expect(
      service.transferOwnership(workspace, currentOwner, nextOwner),
    ).rejects.toThrow("Workspace ownership has already changed");

    em.findOne.mockReset();
    em.findOne.mockResolvedValueOnce(currentOwner).mockResolvedValueOnce(null);
    await expect(
      service.transferOwnership(workspace, currentOwner, nextOwner),
    ).rejects.toThrow("The next owner must be another active user member");
  });

  it("rejects a transfer attempted by a non-owner", async () => {
    const { em, service } = createService();
    const workspace = new TestWorkspace();
    const member = Object.assign(new TestWorkspaceMember(), {
      roles: ["member"],
      user: new TestUser(),
      workspace,
    });
    const nextOwner = Object.assign(new TestWorkspaceMember(), {
      id: "member-2",
      user: new TestUser(),
      workspace,
    });

    await expect(
      service.transferOwnership(workspace, member, nextOwner),
    ).rejects.toThrow(
      "Only the current workspace owner can transfer ownership",
    );
    expect(em.findOne).not.toHaveBeenCalled();
  });

  it("rechecks owner status under a row lock before removing a member", async () => {
    const { em, service } = createService();
    const workspace = new TestWorkspace();
    const staleMember = Object.assign(new TestWorkspaceMember(), {
      roles: ["member"],
      workspace,
    });
    const promotedMember = Object.assign(new TestWorkspaceMember(), {
      id: staleMember.id,
      roles: ["owner"],
      workspace,
    });
    em.findOne.mockResolvedValue(promotedMember);

    await expect(service.removeMember(staleMember)).rejects.toThrow(
      "Workspace owners cannot be removed",
    );
    await expect(service.leaveWorkspace(staleMember)).rejects.toThrow(
      "Workspace owners cannot leave",
    );
    expect(em.findOne).toHaveBeenCalledWith(
      TestWorkspaceMember,
      { id: staleMember.id, workspace },
      { filters: false, lockMode: LockMode.PESSIMISTIC_WRITE },
    );
    expect(em.remove).not.toHaveBeenCalled();
  });

  it("removes a non-owner only after reloading it under a row lock", async () => {
    const { em, service } = createService();
    const workspace = new TestWorkspace();
    const member = Object.assign(new TestWorkspaceMember(), {
      roles: ["member"],
      workspace,
    });
    em.findOne.mockResolvedValue(member);

    await expect(service.removeMember(member)).resolves.toBe(member);
    expect(em.remove).toHaveBeenCalledWith(member);
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

  it("rejects an invitation when the same user is already a member under an old email", async () => {
    const { em, service } = createService();
    const workspace = new TestWorkspace();
    const inviter = Object.assign(new TestUser(), {
      email: "owner@example.com",
    });
    const user = Object.assign(new TestUser(), {
      email: "alice@example.com",
    });
    const member = Object.assign(new TestWorkspaceMember(), {
      email: "old-address@example.com",
      user,
      workspace,
    });
    em.findOne.mockResolvedValueOnce(member).mockResolvedValueOnce(null);

    await expect(
      service.createInvitation(workspace, inviter, { email: user.email }),
    ).rejects.toThrow("User is already a member");
    expect(em.findOne).toHaveBeenNthCalledWith(
      1,
      TestWorkspaceMember,
      {
        workspace,
        $or: [{ email: "alice@example.com" }, { user: { email: user.email } }],
      },
      { filters: false },
    );
  });

  it("rejects duplicate active invitations and unauthenticated email senders", async () => {
    const workspace = new TestWorkspace();
    const inviter = Object.assign(new TestUser(), {
      email: "owner@example.com",
    });
    const activeInvitation = Object.assign(new TestWorkspaceInvitation(), {
      email: "alice@example.com",
      expiresAt: new Date(Date.now() + 60_000),
      status: "pending" as const,
      workspace,
    });
    const duplicate = createService();
    duplicate.em.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(activeInvitation);

    await expect(
      duplicate.service.createInvitation(workspace, inviter, {
        email: activeInvitation.email,
      }),
    ).rejects.toThrow("User is already invited to this workspace");

    const missingSender = createService({
      sendInvitationEmail: vi.fn().mockResolvedValue(undefined),
    });
    missingSender.em.findOne.mockResolvedValue(null);
    await expect(
      missingSender.service.createInvitation(workspace, inviter, {
        email: "bob@example.com",
      }),
    ).rejects.toThrow("Invitation sender is not an active workspace member");
  });

  it("maps invitation uniqueness races to a conflict response", async () => {
    const { em, service } = createService();
    em.transactional.mockRejectedValue(
      new UniqueConstraintViolationException(new Error("duplicate")),
    );

    await expect(
      service.createInvitation(new TestWorkspace(), new TestUser(), {
        email: "alice@example.com",
      }),
    ).rejects.toThrow("User is already invited to this workspace");
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, 1.5])(
    "rejects invalid invitation lifetime %s at the service boundary",
    async (expiresIn) => {
      const { em, service } = createService();

      await expect(
        service.createInvitation(new TestWorkspace(), new TestUser(), {
          email: "alice@example.com",
          expiresIn,
        }),
      ).rejects.toThrow(
        "Workspace invitation lifetime must be a positive integer",
      );
      expect(em.findOne).not.toHaveBeenCalled();
      expect(em.persist).not.toHaveBeenCalled();
    },
  );

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
        email: " INVITED@example.com ",
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

  it("cancels a pending invitation when email delivery fails", async () => {
    const deliveryError = new Error("SMTP unavailable");
    const sendInvitationEmail = vi.fn().mockRejectedValue(deliveryError);
    const { em, service } = createService({ sendInvitationEmail });
    const workspace = new TestWorkspace();
    const inviter = Object.assign(new TestUser(), {
      email: "owner@example.com",
      name: "Owner",
    });
    const inviterMember = Object.assign(new TestWorkspaceMember(), {
      roles: ["owner"],
      user: inviter,
      workspace,
    });
    em.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(inviterMember);

    await expect(
      service.createInvitation(workspace, inviter, {
        email: "invited@example.com",
      }),
    ).rejects.toBe(deliveryError);

    const invitation = em.create.mock.results.at(-1)
      ?.value as TestWorkspaceInvitation;
    expect(em.nativeUpdate).toHaveBeenCalledWith(
      TestWorkspaceInvitation,
      { id: invitation.id, status: "pending" },
      { status: "canceled" },
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
        workspace: { deletedAt: null },
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
    expect(em.flush).toHaveBeenCalledTimes(2);
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
    expect(em.nativeUpdate).toHaveBeenCalledWith(
      TestWorkspaceInvitation,
      expect.objectContaining({
        id: invitation.id,
        status: "pending",
      }),
      { status: "canceled" },
    );
  });

  it("rejects a concurrent invitation cancellation", async () => {
    const { em, service } = createService();
    const invitation = Object.assign(new TestWorkspaceInvitation(), {
      status: "pending" as const,
    });
    em.nativeUpdate.mockResolvedValueOnce(0);

    await expect(service.cancelInvitation(invitation)).rejects.toThrow(
      "Workspace invitation is not pending",
    );
    expect(invitation.status).toBe("pending");
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
    expect(em.nativeUpdate).toHaveBeenCalledWith(
      TestWorkspaceInvitation,
      {
        email: "alice@example.com",
        id: invitation.id,
        status: "pending",
      },
      { status: "rejected" },
    );
  });

  it("rejects a concurrent invitation rejection", async () => {
    const { em, service } = createService();
    const user = Object.assign(new TestUser(), {
      email: "alice@example.com",
    });
    const invitation = Object.assign(new TestWorkspaceInvitation(), {
      email: user.email,
      status: "pending" as const,
    });
    em.nativeUpdate.mockResolvedValueOnce(0);

    await expect(service.rejectInvitation(user, invitation)).rejects.toThrow(
      "Workspace invitation is not pending",
    );
    expect(invitation.status).toBe("pending");
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

  it("does not accept invitations for a deleted workspace", async () => {
    const { em, service } = createService();
    const user = Object.assign(new TestUser(), {
      email: "alice@example.com",
    });
    const workspace = Object.assign(new TestWorkspace(), {
      deletedAt: new Date(),
    });
    const invitation = Object.assign(new TestWorkspaceInvitation(), {
      email: user.email,
      expiresAt: new Date(Date.now() + 60_000),
      status: "pending" as const,
      workspace,
    });
    em.findOne.mockResolvedValueOnce(invitation);

    await expect(service.acceptInvitation(user, invitation.id)).rejects.toThrow(
      "Workspace has been deleted",
    );
    expect(em.persist).not.toHaveBeenCalled();
  });

  it("rejects missing, mismatched, and already-member invitation acceptance", async () => {
    const { em, service } = createService();
    const user = Object.assign(new TestUser(), {
      email: "alice@example.com",
    });

    em.findOne.mockResolvedValueOnce(null);
    await expect(service.acceptInvitation(user, "missing")).resolves.toBeNull();

    const invitation = Object.assign(new TestWorkspaceInvitation(), {
      email: "other@example.com",
      expiresAt: new Date(Date.now() + 60_000),
      status: "pending" as const,
      workspace: new TestWorkspace(),
    });
    em.findOne.mockResolvedValueOnce(invitation);
    await expect(service.acceptInvitation(user, invitation.id)).rejects.toThrow(
      "Workspace invitation belongs to another email address",
    );

    invitation.email = user.email;
    em.findOne
      .mockResolvedValueOnce(invitation)
      .mockResolvedValueOnce(new TestWorkspaceMember());
    await expect(service.acceptInvitation(user, invitation.id)).rejects.toThrow(
      "User is already a member",
    );
  });

  it("rejects invalid invitation state transitions and missing members", async () => {
    const { em, service } = createService();
    const workspace = new TestWorkspace();
    const user = Object.assign(new TestUser(), {
      email: "alice@example.com",
    });
    const completed = Object.assign(new TestWorkspaceInvitation(), {
      email: user.email,
      status: "accepted" as const,
      workspace,
    });

    await expect(service.cancelInvitation(completed)).rejects.toThrow(
      "Workspace invitation is not pending",
    );
    await expect(service.rejectInvitation(user, completed)).rejects.toThrow(
      "Workspace invitation is not pending",
    );

    const addressedToAnotherUser = Object.assign(
      new TestWorkspaceInvitation(),
      {
        email: "other@example.com",
        status: "pending" as const,
        workspace,
      },
    );
    await expect(
      service.rejectInvitation(user, addressedToAnotherUser),
    ).rejects.toThrow("Workspace invitation belongs to another email address");

    const member = Object.assign(new TestWorkspaceMember(), {
      roles: ["member"],
      workspace,
    });
    em.findOne.mockResolvedValue(null);
    await expect(service.removeMember(member)).rejects.toThrow(
      "Workspace member not found",
    );
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
    nativeUpdate: vi.fn(),
    persist: vi.fn(),
    remove: vi.fn(),
    transactional: vi.fn(),
  } as unknown as Mocked<EntityManager>;
  em.persist.mockReturnValue(em);
  em.remove.mockReturnValue(em);
  em.nativeUpdate.mockResolvedValue(1);
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
  const accessControlService = {
    assertCurrentUser: vi.fn(),
    assertCurrentWorkspace: vi.fn(),
    assertCurrentWorkspaceMember: vi.fn(),
    assertUserCan: vi.fn(),
    assertWorkspaceCan: vi.fn(),
    assertCanGrantWorkspacePermissions: vi.fn(),
  } as unknown as AccessControlService;
  return {
    accessControlService,
    em,
    service: new WorkspaceService<
      TestWorkspace,
      TestWorkspaceMember,
      TestWorkspaceInvitation,
      TestUser
    >(em, options, accessControlService),
  };
}
