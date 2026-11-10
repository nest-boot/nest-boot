import { ForbiddenException } from "@nestjs/common";
import { type GraphQLResolveInfo } from "graphql";
import { type Mocked } from "vitest";

import { Member } from "../entities/member.entity.js";
import { MemberApiKey as BaseApiKey } from "../entities/member-api-key.entity.js";
import { User as BaseUser, User } from "../entities/user.entity.js";
import {
  Workspace as BaseWorkspace,
  Workspace,
} from "../entities/workspace.entity.js";
import { type InvitationService } from "../features/invitations/invitation.service.js";
import { type MemberService } from "../services/member.service.js";
import { type MemberApiKeyService } from "../services/member-api-key.service.js";
import { type UserService } from "../services/user.service.js";
import { type UserApiKeyService } from "../services/user-api-key.service.js";
import { type WorkspaceService } from "../services/workspace.service.js";
import { UserResolver } from "./user.resolver.js";
import { WorkspaceResolver } from "./workspace.resolver.js";

describe("WorkspaceResolver", () => {
  it("passes the parent workspace and pagination to the service and propagates denial", async () => {
    const workspace = { id: "parent-workspace" } as Workspace;
    const args = { first: 10, after: "cursor" };
    const connection = { edges: [], pageInfo: {} };
    const getInvitationConnectionByWorkspace = vi
      .fn()
      .mockResolvedValueOnce(connection)
      .mockRejectedValueOnce(new ForbiddenException());
    const { resolver } = createResolver(
      {},
      {},
      { getInvitationConnectionByWorkspace },
    );
    await expect(resolver.invitations(workspace, args)).resolves.toBe(
      connection,
    );
    expect(getInvitationConnectionByWorkspace).toHaveBeenCalledWith(
      workspace,
      args,
      undefined,
    );
    await expect(resolver.invitations(workspace, args)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
  it("delegates current workspace access and failures to the service", () => {
    const workspace = { id: "workspace_1" } as Workspace;
    const getCurrentWorkspace = vi
      .fn()
      .mockReturnValueOnce(workspace)
      .mockReturnValueOnce(null)
      .mockImplementationOnce(() => {
        throw new ForbiddenException();
      });
    const { resolver } = createResolver({ getCurrentWorkspace });
    expect(resolver.currentWorkspace()).toBe(workspace);
    expect(resolver.currentWorkspace()).toBeNull();
    expect(() => resolver.currentWorkspace()).toThrow(ForbiddenException);
  });
  it("forwards workspace lookup arguments and nullable service results", async () => {
    const workspace = { id: "workspace_1" } as Workspace;
    const user = { id: "user_1" } as User;
    const { resolver, workspaceService } = createResolver({
      getUserWorkspace: vi.fn(async () => workspace),
    });
    await expect(resolver.workspace(workspace.id, user)).resolves.toBe(
      workspace,
    );
    expect(workspaceService.getUserWorkspace).toHaveBeenCalledWith(
      workspace.id,
      user,
    );
    workspaceService.getUserWorkspace.mockResolvedValueOnce(null);
    await expect(resolver.workspace(workspace.id, user)).resolves.toBeNull();
  });
  it("delegates workspace lifecycle operations to WorkspaceService", async () => {
    const workspace = { id: "workspace_1", name: "Acme" } as Workspace;
    const user = { id: "user_1" } as User;
    const { resolver, workspaceService } = createResolver({
      createWorkspace: vi.fn(async () => workspace),
      updateWorkspace: vi.fn(async () => workspace),
      deleteWorkspace: vi.fn(async () => workspace),
    });
    await expect(
      resolver.createWorkspace(user, { name: "Acme" }),
    ).resolves.toEqual({ id: workspace.id });
    await expect(
      resolver.updateWorkspace(workspace.id, { name: "New" }),
    ).resolves.toEqual({ id: workspace.id });
    await expect(resolver.deleteWorkspace(workspace.id)).resolves.toEqual({
      id: workspace.id,
    });
    expect(workspaceService.createWorkspace).toHaveBeenCalledWith(user, {
      name: "Acme",
    });
    expect(workspaceService.updateWorkspace).toHaveBeenCalledWith(
      workspace.id,
      {
        name: "New",
      },
    );
    expect(workspaceService.deleteWorkspace).toHaveBeenCalledWith(workspace.id);
  });
  it("delegates leaving a workspace to MemberService", async () => {
    const member = { id: "member_1", name: "Leaving member" } as Member;
    const { resolver, memberService } = createResolver(
      {},
      {
        leaveWorkspace: vi.fn(async () => member),
      },
    );
    await expect(resolver.leaveWorkspace(member)).resolves.toEqual({
      memberId: member.id,
    });
    expect(memberService.leaveWorkspace).toHaveBeenCalledWith(member);
    const denied = new ForbiddenException();
    memberService.leaveWorkspace.mockRejectedValueOnce(denied);
    await expect(resolver.leaveWorkspace(member)).rejects.toBe(denied);
  });
});

/**
 * Returns test resolver and its mocked dependencies.
 * @param overrides - Fixture values that replace the defaults.
 * @param memberOverrides - Member service methods replaced for this test.
 * @param invitationOverrides - Invitation service methods replaced for this test.
 * @returns Test resolver and its mocked dependencies.
 */
function createResolver(
  overrides: Partial<WorkspaceService> = {},
  memberOverrides: Partial<MemberService> = {},
  invitationOverrides: Partial<InvitationService> = {},
) {
  const workspaceService = { ...overrides } as Mocked<WorkspaceService>;
  const memberService = {
    ...memberOverrides,
  } as Mocked<MemberService>;
  const invitationService = {
    ...invitationOverrides,
  } as Mocked<InvitationService>;
  return {
    resolver: new WorkspaceResolver(
      workspaceService,
      {} as never,
      memberService,
      invitationService,
    ),
    workspaceService,
    memberService,
    invitationService,
  };
}

describe("API-key field delegation", () => {
  describe("API-key field delegation", () => {
    it.each(
      (["user", "workspace"] as const).filter((_row, index) => index === 1),
    )(
      "passes the %s parent and ID to the service, preserving null and authorization errors",
      async (scope) => {
        const key = new BaseApiKey();
        const getKey = vi.fn().mockResolvedValue(key);
        const service = {
          getUserApiKey: getKey,
          getMemberApiKey: getKey,
        } as unknown as MemberApiKeyService;
        const user = new BaseUser();
        const workspace = new BaseWorkspace();
        const resolve =
          scope === "user"
            ? () =>
                new UserResolver(
                  {} as UserService,
                  {} as WorkspaceService,
                  service as unknown as UserApiKeyService,
                  {} as never,
                  {} as never,
                  {} as never,
                ).apiKey(user, "key_1")
            : () =>
                new WorkspaceResolver(
                  {} as WorkspaceService,
                  service,
                  {} as never,
                  {} as never,
                ).apiKey(workspace, "key_1");
        await expect(resolve()).resolves.toBe(key);
        expect(getKey).toHaveBeenCalledWith(
          "key_1",
          scope === "user" ? user : workspace,
        );
        getKey.mockResolvedValue(null);
        await expect(resolve()).resolves.toBeNull();
        getKey.mockRejectedValue(new ForbiddenException());
        await expect(resolve()).rejects.toBeInstanceOf(ForbiddenException);
      },
    );
  });
});

describe("connection-selection.spec.ts", () => {
  describe("WorkspaceResolver connection fields", () => {
    it("preserves parents, pagination, selection, results and authorization errors", async () => {
      const result = { edges: [], pageInfo: {} };
      const services = {
        getMemberConnectionByWorkspace: vi.fn().mockResolvedValue(result),
        getInvitationConnectionByWorkspace: vi.fn().mockResolvedValue(result),
        getMemberApiKeyConnection: vi.fn().mockResolvedValue(result),
      };
      const resolver = new WorkspaceResolver(
        services as never,
        services as never,
        services as never,
        services as never,
      );
      const parent = Object.assign(new Workspace(), { id: "workspace" });
      const args = { first: 10, after: "cursor" };
      const info = {
        fieldNodes: [],
        fragments: {},
        variableValues: {},
      } as unknown as GraphQLResolveInfo;
      await expect(resolver.members(parent, args, info)).resolves.toBe(result);
      await expect(resolver.invitations(parent, args, info)).resolves.toBe(
        result,
      );
      await expect(resolver.apiKeys(parent, args, info)).resolves.toBe(result);
      expect(
        services.getMemberConnectionByWorkspace,
      ).toHaveBeenCalledExactlyOnceWith(parent, args, info);
      expect(
        services.getInvitationConnectionByWorkspace,
      ).toHaveBeenCalledExactlyOnceWith(parent, args, info);
      expect(
        services.getMemberApiKeyConnection,
      ).toHaveBeenCalledExactlyOnceWith(parent, args, info);
      for (const method of Object.values(services)) {
        method.mockRejectedValue(new ForbiddenException());
      }
      await expect(resolver.members(parent, args, info)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await expect(
        resolver.invitations(parent, args, info),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(resolver.apiKeys(parent, args, info)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });
});
