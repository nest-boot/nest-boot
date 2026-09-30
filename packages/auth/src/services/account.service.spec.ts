import { EntityManager } from "@mikro-orm/core";
import { ConnectionManager } from "@nest-boot/graphql-connection";
import { RequestContext } from "@nest-boot/request-context";
import { ForbiddenException } from "@nestjs/common";
import type { GraphQLResolveInfo } from "graphql";

import { mockRlsContext } from "../../test/mock-rls-context.js";
import { API_KEY } from "../auth.constants.js";
import { AccountConnection } from "../connections/account.connection-definition.js";
import { Account } from "../entities/account.entity.js";
import { User } from "../entities/user.entity.js";
import { WorkspaceApiKey } from "../entities/workspace-api-key.entity.js";
import { AccountService } from "./account.service.js";

describe("AccountService", () => {
  afterEach(() => vi.restoreAllMocks());

  it.each([undefined, { fieldNodes: [] } as unknown as GraphQLResolveInfo])(
    "paginates only the current user's accounts, excluding credentials and preserving RLS (selection: %j)",
    async (info) => {
      const { service, em, user, fork } = createService();
      const context = mockRlsContext(em);
      const account = Object.assign(new Account(), {
        password: "hash",
        accessToken: "access",
        refreshToken: "refresh",
        idToken: "id-secret",
      });
      const result = {
        edges: [{ cursor: "cursor", node: account }],
        pageInfo: {},
      };
      const find = vi
        .spyOn(ConnectionManager.prototype, "find")
        .mockResolvedValue(result as never);
      const args = { first: 10, after: "cursor" };
      await RequestContext.run(
        new RequestContext({ type: "test" }),
        async () => {
          RequestContext.set(User, user);
          const connection = await service.getAccountConnectionByUser(
            user,
            args,
            info,
          );
          for (const key of [
            "password",
            "accessToken",
            "refreshToken",
            "idToken",
          ]) {
            expect(connection.edges[0].node).not.toHaveProperty(key);
            expect(Reflect.get(account, key)).toBeTruthy();
          }
          expect(connection.pageInfo).toBe(result.pageInfo);
        },
      );
      expect(find).toHaveBeenCalledWith(AccountConnection, args, {
        ...(info && { info }),
        where: { user: "self" },
        exclude: ["password", "accessToken", "refreshToken", "idToken"],
      });
      expect(find.mock.instances[0]).toHaveProperty("em", em);
      expect(em.getSessionContext()).toEqual(context);
      expect(fork).not.toHaveBeenCalled();
    },
  );

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
  return {
    fork,
    em,
    user: Object.assign(new User(), { id: "self" }),
    service: new AccountService(em),
  };
}
