import { RequestContext } from "@nest-boot/request-context";
import { ForbiddenException } from "@nestjs/common";

import {
  Member,
  Session,
  User,
  UserApiKey,
  Workspace,
  WorkspaceApiKey,
} from "../entities/index.js";
import { RequestIdentity } from "./request-identity.js";

describe("request identity checks", () => {
  it.each([
    [User, RequestIdentity.assertCurrentUser.bind(RequestIdentity)],
    [Session, RequestIdentity.assertCurrentSession.bind(RequestIdentity)],
    [Workspace, RequestIdentity.assertCurrentWorkspace.bind(RequestIdentity)],
    [Member, RequestIdentity.assertCurrentMember.bind(RequestIdentity)],
  ] as const)(
    "checks current %s identity inside and outside a request",
    async (Entity, check) => {
      const target = Object.assign(new Entity(), { id: "one", token: "one" });
      const invoke = (entity: unknown) => {
        check(entity as never);
      };
      expect(() => {
        invoke(target);
      }).toThrow(ForbiddenException);
      await RequestContext.run(
        new RequestContext({ type: "test" }),
        (context) => {
          expect(() => {
            invoke(target);
          }).toThrow(ForbiddenException);
          context.set(Entity as never, target);
          expect(() => {
            invoke(target);
          }).not.toThrow();
          expect(() => {
            invoke(Object.assign(new Entity(), { id: "two", token: "two" }));
          }).toThrow(ForbiddenException);
        },
      );
    },
  );
  it("rejects a missing member before touching its identity", () => {
    expect(() => {
      RequestIdentity.assertCurrentMember(null);
    }).toThrow(ForbiddenException);
    expect(() => {
      RequestIdentity.assertCurrentMember(undefined);
    }).toThrow(ForbiddenException);
  });
  it.each([UserApiKey, WorkspaceApiKey])(
    "keeps self-service unavailable to %s",
    async (Key) => {
      await RequestContext.run(new RequestContext({ type: "test" }), () => {
        const user = new User();
        RequestIdentity.stage({ user });
        expect(() => {
          RequestIdentity.assertUserSession(user);
        }).not.toThrow();
        expect(() => {
          RequestIdentity.assertUserSession(new User());
        }).toThrow(ForbiddenException);
        RequestIdentity.stage({ apiKey: new Key() });
        expect(() => {
          RequestIdentity.assertUserSession(user);
        }).toThrow("requires a user session");
      });
    },
  );
});
