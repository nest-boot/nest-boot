import type { GraphQLResolveInfo } from "graphql";

import { User } from "../entities/user.entity.js";
import { User as BaseUser } from "../entities/user.entity.js";
import { type AccountService } from "../services/account.service.js";
import { type SessionService } from "../services/session.service.js";
import { UserResolver } from "./user.resolver.js";

describe("UserResolver self-service relations", () => {
  it("retains selection information when resolving session and account connections", async () => {
    const user = new User();
    const args = { first: 10 };
    const info = {
      fieldNodes: [],
      fragments: {},
      variableValues: {},
    } as unknown as GraphQLResolveInfo;
    const result = { edges: [], pageInfo: {} };
    const getSessionConnectionByUser = vi.fn().mockResolvedValue(result);
    const getAccountConnectionByUser = vi.fn().mockResolvedValue(result);
    const resolver = new UserResolver(
      { getSessionConnectionByUser } as unknown as SessionService,
      { getAccountConnectionByUser } as unknown as AccountService,
    );
    await expect(resolver.sessions(user, args, info)).resolves.toBe(result);
    await expect(resolver.accounts(user, args, info)).resolves.toBe(result);
    expect(getSessionConnectionByUser).toHaveBeenCalledExactlyOnceWith(
      user,
      args,
      info,
    );
    expect(getAccountConnectionByUser).toHaveBeenCalledExactlyOnceWith(
      user,
      args,
      info,
    );
  });

  it("delegates account pagination and authorization to AccountService", async () => {
    const user = { id: "self" } as BaseUser;
    const args = { first: 10, after: "cursor" };
    const result = { edges: [], pageInfo: {} };
    const getAccountConnectionByUser = vi.fn().mockResolvedValue(result);
    const resolver = new UserResolver(
      {} as never,
      { getAccountConnectionByUser } as unknown as AccountService,
    );
    await expect(resolver.accounts(user, args)).resolves.toBe(result);
    expect(getAccountConnectionByUser).toHaveBeenCalledWith(
      user,
      args,
      undefined,
    );
    const denied = new Error("Account access denied");
    getAccountConnectionByUser.mockRejectedValueOnce(denied);
    await expect(resolver.accounts(user, args)).rejects.toBe(denied);
  });

  it("resolves the parent user's sessions through the authorized service", async () => {
    const user = { id: "parent-user" } as BaseUser;
    const sessions = [{ id: "session-1", customField: "application-owned" }];
    const getSessionConnectionByUser = vi.fn().mockResolvedValue(sessions);
    const { resolver } = createResolver({ getSessionConnectionByUser });
    await expect(resolver.sessions(user, { first: 10 })).resolves.toBe(
      sessions,
    );
    expect(getSessionConnectionByUser).toHaveBeenCalledWith(
      user,
      { first: 10 },
      undefined,
    );
    const denied = new Error("session access denied");
    getSessionConnectionByUser.mockRejectedValueOnce(denied);
    await expect(resolver.sessions(user, { first: 10 })).rejects.toBe(denied);
  });
});
/**
 *
 * @param sessionOverrides - Session methods replaced for this test.
 * @returns Resolver and its mocked dependencies.
 */
function createResolver(sessionOverrides: Partial<SessionService> = {}) {
  return {
    resolver: new UserResolver(
      sessionOverrides as SessionService,
      {} as AccountService,
    ),
  };
}
