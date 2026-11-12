import { ForbiddenException } from "@nestjs/common";
import { type Mocked } from "vitest";

import { User as BaseUser } from "../../core/entities/user.entity.js";
import { Workspace } from "../entities/workspace.entity.js";
import {
  WorkspaceMember as BaseWorkspaceMember,
  WorkspaceMember,
} from "../entities/workspace-member.entity.js";
import { WorkspaceMemberStatus } from "../enums/workspace-member-status.enum.js";
import { WorkspaceMemberType } from "../enums/workspace-member-type.enum.js";
import { type WorkspaceMemberService } from "../services/workspace-member.service.js";
import { WorkspaceMemberResolver } from "./workspace-member.resolver.js";

describe("WorkspaceMemberResolver", () => {
  it("requires the appropriate identity fields when adding user members and service accounts", async () => {
    const workspace = new Workspace();
    const { resolver, workspaceMemberService } = createResolver({
      workspaceMemberService: {
        addWorkspaceServiceAccount: vi
          .fn()
          .mockResolvedValue({ id: "service-member" }),
      },
    });
    await expect(
      resolver.addWorkspaceMember(workspace, {
        type: WorkspaceMemberType.SERVICE_ACCOUNT,
        name: "Bot",
        roles: [],
        permissions: ["workspace:update"],
      }),
    ).resolves.toEqual({ id: "service-member" });
    expect(
      workspaceMemberService.addWorkspaceServiceAccount,
    ).toHaveBeenCalledWith(workspace, "Bot", {
      roles: [],
      permissions: ["workspace:update"],
    });
    for (const input of [
      {},
      { type: WorkspaceMemberType.SERVICE_ACCOUNT },
      {
        type: WorkspaceMemberType.SERVICE_ACCOUNT,
        name: "Bot",
        email: "login@example.test",
      },
    ]) {
      await expect(
        resolver.addWorkspaceMember(workspace, input),
      ).rejects.toThrow();
    }
    expect(
      workspaceMemberService.addWorkspaceMemberByEmail,
    ).not.toHaveBeenCalled();
    expect(
      workspaceMemberService.addWorkspaceServiceAccount,
    ).toHaveBeenCalledOnce();
  });
  it("returns the current workspace member from request context", () => {
    const member = { id: "member_1" } as WorkspaceMember;
    const { resolver } = createResolver({
      workspaceMemberService: {
        getCurrentWorkspaceMember: vi.fn(() => member),
      },
    });
    expect(resolver.currentWorkspaceMember()).toBe(member);
  });
  it("returns null when no current workspace member is available", () => {
    const { resolver } = createResolver();
    expect(resolver.currentWorkspaceMember()).toBeNull();
  });
  it("finds a member by id through the service", async () => {
    const member = { id: "member_1" } as WorkspaceMember;
    const { resolver, workspaceMemberService } = createResolver({
      workspaceMemberService: {
        getWorkspaceMember: vi.fn(async () => member),
      },
    });
    await expect(resolver.workspaceMember("member_1")).resolves.toBe(member);
    expect(workspaceMemberService.getWorkspaceMember).toHaveBeenCalledWith(
      "member_1",
    );
  });
  it("delegates adding an existing user to WorkspaceMemberService", async () => {
    const workspace = { id: "workspace_1" } as Workspace;
    const createdWorkspaceMember = { id: "member_2" } as WorkspaceMember;
    const { resolver, workspaceMemberService } = createResolver({
      workspaceMemberService: {
        addWorkspaceMemberByEmail: vi.fn(async () => createdWorkspaceMember),
      },
    });
    await expect(
      resolver.addWorkspaceMember(workspace, { email: "alice@example.com" }),
    ).resolves.toEqual({ id: createdWorkspaceMember.id });
    expect(
      workspaceMemberService.addWorkspaceMemberByEmail,
    ).toHaveBeenCalledWith(workspace, "alice@example.com", {
      roles: undefined,
      permissions: undefined,
    });
  });
  it("forwards permission changes and propagates service errors", async () => {
    const denied = new ForbiddenException();
    const { resolver, workspaceMemberService } = createResolver({
      workspaceMemberService: {
        setWorkspaceMemberPermissions: vi.fn().mockRejectedValue(denied),
      },
    });
    await expect(
      resolver.setWorkspaceMemberPermissions("member_2", {
        permissions: [],
      }),
    ).rejects.toBe(denied);
    expect(
      workspaceMemberService.setWorkspaceMemberPermissions,
    ).toHaveBeenCalledWith("member_2", []);
  });
  it("forwards member updates without a preliminary lookup", async () => {
    const updated = {
      id: "member_2",
      status: WorkspaceMemberStatus.DISABLED,
    } as WorkspaceMember;
    const { resolver, workspaceMemberService } = createResolver({
      workspaceMemberService: {
        updateWorkspaceMember: vi.fn(async () => updated),
      },
    });
    await expect(
      resolver.updateWorkspaceMember("member_2", {
        status: WorkspaceMemberStatus.DISABLED,
      }),
    ).resolves.toEqual({ id: updated.id });
    expect(workspaceMemberService.updateWorkspaceMember).toHaveBeenCalledWith(
      updated.id,
      {
        status: WorkspaceMemberStatus.DISABLED,
      },
    );
    expect(workspaceMemberService.getWorkspaceMember).not.toHaveBeenCalled();
  });
  it("propagates update errors from WorkspaceMemberService", async () => {
    const denied = new ForbiddenException();
    const input = { status: WorkspaceMemberStatus.DISABLED };
    const { resolver, workspaceMemberService } = createResolver({
      workspaceMemberService: {
        updateWorkspaceMember: vi.fn().mockRejectedValue(denied),
      },
    });
    await expect(
      resolver.updateWorkspaceMember("member_2", input),
    ).rejects.toBe(denied);
    expect(workspaceMemberService.updateWorkspaceMember).toHaveBeenCalledWith(
      "member_2",
      input,
    );
  });
  it("lists roles and updates member roles through WorkspaceMemberService", async () => {
    const member = { id: "member_2", roles: ["member"] } as WorkspaceMember;
    const roles = [{ role: "admin", grantable: false }];
    const permissions = [{ permission: "workspace:update", grantable: true }];
    const { resolver, workspaceMemberService } = createResolver({
      workspaceMemberService: {
        listPermissions: vi.fn(() => permissions),
        listRoles: vi.fn(() => roles),
        setWorkspaceMemberRoles: vi.fn(async () => member),
      },
    });
    expect(resolver.workspaceRoles()).toEqual(roles);
    expect(resolver.workspacePermissions()).toEqual(permissions);
    await expect(
      resolver.setWorkspaceMemberRoles(member.id, {
        roles: ["admin"],
      }),
    ).resolves.toEqual({ id: member.id });
    expect(workspaceMemberService.getWorkspaceMember).not.toHaveBeenCalled();
    expect(workspaceMemberService.setWorkspaceMemberRoles).toHaveBeenCalledWith(
      member.id,
      ["admin"],
    );
  });
  it("propagates removal errors from WorkspaceMemberService", async () => {
    const denied = new ForbiddenException();
    const { resolver, workspaceMemberService } = createResolver({
      workspaceMemberService: {
        removeWorkspaceMember: vi.fn().mockRejectedValue(denied),
      },
    });
    await expect(resolver.removeWorkspaceMember("member_1")).rejects.toBe(
      denied,
    );
    expect(workspaceMemberService.removeWorkspaceMember).toHaveBeenCalledWith(
      "member_1",
    );
  });
  it("returns only the removed member identifier", async () => {
    const member = {
      id: "member_2",
      name: "Removed member",
    } as WorkspaceMember;
    const { resolver, workspaceMemberService } = createResolver({
      workspaceMemberService: {
        removeWorkspaceMember: vi.fn(async () => member),
      },
    });
    await expect(resolver.removeWorkspaceMember("member_2")).resolves.toEqual({
      id: member.id,
    });
    expect(workspaceMemberService.removeWorkspaceMember).toHaveBeenCalledWith(
      member.id,
    );
  });
});

/**
 * Returns test resolver and its mocked dependencies.
 * @param overrides - Fixture values that replace the defaults.
 * @param overrides.workspaceMemberService - WorkspaceMember service methods replaced for this test.
 * @returns Test resolver and its mocked dependencies.
 */
function createResolver(overrides?: {
  workspaceMemberService?: Partial<WorkspaceMemberService>;
}) {
  const workspaceMemberService = {
    addWorkspaceMemberByEmail: vi.fn(),
    addWorkspaceServiceAccount: vi.fn(),
    getWorkspaceMember: vi.fn(),
    getCurrentWorkspaceMember: vi.fn(() => null),
    getWorkspaceMemberListFilter: vi.fn((workspace) => ({ workspace })),
    listPermissions: vi.fn(() => []),
    listRoles: vi.fn(() => []),
    removeWorkspaceMember: vi.fn(),
    setWorkspaceMemberPermissions: vi.fn(),
    updateWorkspaceMember: vi.fn(),
    setWorkspaceMemberRoles: vi.fn(),
    ...overrides?.workspaceMemberService,
  } as unknown as Mocked<WorkspaceMemberService>;
  const resolver = new WorkspaceMemberResolver(workspaceMemberService);
  return {
    resolver,
    workspaceMemberService,
  };
}

describe("relation fields", () => {
  describe("workspace relation fields", () => {
    it("delegates member users, including null, to the service", async () => {
      const user = new BaseUser();
      const member = new BaseWorkspaceMember();
      const service = {
        getWorkspaceMemberUser: vi
          .fn()
          .mockResolvedValueOnce(user)
          .mockResolvedValueOnce(null),
      };
      const resolver = new WorkspaceMemberResolver(
        service as unknown as WorkspaceMemberService,
      );
      await expect(resolver.user(member)).resolves.toBe(user);
      await expect(resolver.user(member)).resolves.toBeNull();
      expect(service.getWorkspaceMemberUser).toHaveBeenCalledWith(member);
    });
  });
});
