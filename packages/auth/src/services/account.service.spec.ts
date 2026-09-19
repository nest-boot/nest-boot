import { EntityManager } from "@mikro-orm/core";
import { ConnectionManager } from "@nest-boot/graphql-connection";
import { RequestContext } from "@nest-boot/request-context";
import { ForbiddenException } from "@nestjs/common";

import { mockRlsContext } from "../../test/mock-rls-context.js";
import { API_KEY } from "../auth.constants.js";
import type { AuthModuleOptions } from "../auth-module-options.interface.js";
import { AccountConnection } from "../connections/account.connection-definition.js";
import { User } from "../entities/user.entity.js";
import { WorkspaceApiKey } from "../entities/workspace-api-key.entity.js";
import { AccessControlService } from "./access-control.service.js";
import { AccountService } from "./account.service.js";

describe("AccountService", () => {
  afterEach(() => vi.restoreAllMocks());

  it("paginates only the current user's accounts, excluding credentials and preserving RLS", async () => {
    const { service, em, user, fork } = createService();
    const context = mockRlsContext(em);
    const result = { edges: [], pageInfo: {} };
    const find = vi
      .spyOn(ConnectionManager.prototype, "find")
      .mockResolvedValue(result as never);
    const args = { first: 10, after: "cursor" };
    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      RequestContext.set(User, user);
      await expect(
        service.getAccountConnectionByUser(user, args),
      ).resolves.toBe(result);
    });
    expect(find).toHaveBeenCalledWith(AccountConnection, args, {
      where: { user: "self" },
      exclude: ["password", "accessToken", "refreshToken", "idToken"],
    });
    expect(find.mock.instances[0]).toHaveProperty("em", em);
    expect(em.getSessionContext()).toEqual(context);
    expect(fork).not.toHaveBeenCalled();
  });

  it.each(["foreign-user", "api-key", "anonymous", "no-context"])(
    "rejects %s before constructing a connection query",
    async (identity) => {
      const { service, user } = createService();
      const find = vi.spyOn(ConnectionManager.prototype, "find");
      const check = async () => {
        await expect(
          service.getAccountConnectionByUser(user, { first: 10 }),
        ).rejects.toThrow(ForbiddenException);
      };
      if (identity === "no-context") {
        await check();
      } else {
        await RequestContext.run(
          new RequestContext({ type: "test" }),
          async () => {
            if (identity !== "anonymous")
              RequestContext.set(
                User,
                identity === "foreign-user"
                  ? Object.assign(new User(), { id: "other" })
                  : user,
              );
            if (identity === "api-key")
              RequestContext.set(API_KEY, new WorkspaceApiKey());
            await check();
          },
        );
      }
      expect(find).not.toHaveBeenCalled();
    },
  );
});

function createService() {
  const fork = vi.fn();
  const em = {
    fork,
    getSessionContext: vi.fn(),
  } as unknown as EntityManager;
  const access = new AccessControlService({} as AuthModuleOptions);
  return {
    fork,
    em,
    user: Object.assign(new User(), { id: "self" }),
    service: new AccountService(em, access),
  };
}
