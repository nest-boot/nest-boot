import { RequestContext } from "@nest-boot/request-context";
import { ForbiddenException } from "@nestjs/common";

import { stageIdentity } from "../../../test/fixtures/auth-context.fixture.js";
import { UserApiKey } from "../../api-key/objects/user-api-key.object.js";
import { WorkspaceApiKey } from "../../api-key/objects/workspace-api-key.object.js";
import { Workspace } from "../../workspace/entities/workspace.entity.js";
import { WorkspaceMember } from "../../workspace/entities/workspace-member.entity.js";
import { SELECTED_WORKSPACE } from "../constants/auth.constants.js";
import { Session } from "../entities/session.entity.js";
import { User } from "../entities/user.entity.js";
import {
  assertCurrentSession,
  assertCurrentUser,
  assertCurrentWorkspace,
  assertCurrentWorkspaceMember,
  assertUserSession,
} from "./assert-current-identity.util.js";
describe("identity assertions", () => {
  describe("request identity checks", () => {
    it.each([
      [User, assertCurrentUser],
      [Session, assertCurrentSession],
      [Workspace, assertCurrentWorkspace],
      [WorkspaceMember, assertCurrentWorkspaceMember],
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
            context.set<InstanceType<typeof Entity>>(
              Entity === Workspace ? SELECTED_WORKSPACE : Entity,
              target,
            );
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
        assertCurrentWorkspaceMember(null);
      }).toThrow(ForbiddenException);
      expect(() => {
        assertCurrentWorkspaceMember(undefined);
      }).toThrow(ForbiddenException);
    });
    it.each([UserApiKey, WorkspaceApiKey])(
      "keeps self-service unavailable to %s",
      async (Key) => {
        await RequestContext.run(new RequestContext({ type: "test" }), () => {
          const user = new User();
          stageIdentity({ user });
          expect(() => {
            assertUserSession(user);
          }).not.toThrow();
          expect(() => {
            assertUserSession(new User());
          }).toThrow(ForbiddenException);
          stageIdentity({ apiKey: new Key() });
          expect(() => {
            assertUserSession(user);
          }).toThrow("requires a user session");
        });
      },
    );
  });
});
