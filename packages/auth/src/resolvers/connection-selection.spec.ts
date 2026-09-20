import type { GraphQLResolveInfo } from "graphql";

import { User } from "../entities/user.entity.js";
import { Workspace } from "../entities/workspace.entity.js";
import { UserResolver } from "./user.resolver.js";
import { WorkspaceResolver } from "./workspace.resolver.js";

describe("auth connection selections", () => {
  it("forwards the exact field selection through every user and workspace connection", async () => {
    const services = {
      getUserConnection: vi.fn(),
      getSessionConnectionByUser: vi.fn(),
      getAccountConnectionByUser: vi.fn(),
      getWorkspaceConnectionByUser: vi.fn(),
      getInvitationConnectionByUser: vi.fn(),
      getInvitationConnectionByWorkspace: vi.fn(),
      getMemberConnectionByWorkspace: vi.fn(),
      getUserApiKeyConnection: vi.fn(),
      getWorkspaceApiKeyConnection: vi.fn(),
    };
    const userResolver = new UserResolver(
      services as never,
      services as never,
      services as never,
      services as never,
      services as never,
      services as never,
    );
    const workspaceResolver = new WorkspaceResolver(
      services as never,
      services as never,
      services as never,
      services as never,
    );
    const info = {
      fieldNodes: [],
      fragments: {},
      variableValues: {},
    } as unknown as GraphQLResolveInfo;
    const user = Object.assign(new User(), { id: "user" });
    const workspace = Object.assign(new Workspace(), { id: "workspace" });
    const args = { first: 10 };
    await userResolver.users(args, info);
    await userResolver.sessions(user, args, info);
    await userResolver.accounts(user, args, info);
    await userResolver.workspaces(user, args, info);
    await userResolver.invitations(user, args, info);
    await userResolver.apiKeys(user, args, info);
    await workspaceResolver.members(workspace, args, info);
    await workspaceResolver.invitations(workspace, args, info);
    await workspaceResolver.apiKeys(workspace, args, info);
    expect(services.getUserConnection).toHaveBeenCalledExactlyOnceWith(
      args,
      info,
    );
    for (const name of [
      "getSessionConnectionByUser",
      "getAccountConnectionByUser",
      "getWorkspaceConnectionByUser",
      "getInvitationConnectionByUser",
      "getUserApiKeyConnection",
    ] as const) {
      expect(services[name]).toHaveBeenCalledExactlyOnceWith(user, args, info);
    }
    for (const name of [
      "getMemberConnectionByWorkspace",
      "getInvitationConnectionByWorkspace",
      "getWorkspaceApiKeyConnection",
    ] as const) {
      expect(services[name]).toHaveBeenCalledExactlyOnceWith(
        workspace,
        args,
        info,
      );
    }
  });
});
