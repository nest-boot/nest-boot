import { RequestContext } from "@nest-boot/request-context";
import { assert } from "vitest";

import { AuthAbility } from "../abilities/auth.ability.js";
import { API_KEY } from "../auth.constants.js";
import type { AuthModuleOptions } from "../auth-module-options.interface.js";
import { Member } from "../entities/member.entity.js";
import { User } from "../entities/user.entity.js";
import { UserApiKey } from "../entities/user-api-key.entity.js";
import { Workspace } from "../entities/workspace.entity.js";
import { RequestIdentity } from "./request-identity.js";

describe("post-commit request authorization", () => {
  it.each([false, true])(
    "retains API-key ceilings and fails closed if the custom builder throws (failure=%s)",
    async (failure) => {
      const options: AuthModuleOptions = {
        buildAbility: (_rules) => {
          if (failure) throw new Error("Invalid ability configuration");
        },

        user: {
          roles: { admin: ["user:read", "user:delete"] },
        },
        workspace: {
          roles: { owner: ["workspace:read", "workspace:delete"] },
        },
      };
      await RequestContext.run(new RequestContext({ type: "test" }), () => {
        RequestContext.set(
          User,
          Object.assign(new User(), { roles: ["admin"] }),
        );
        RequestContext.set(
          Member,
          Object.assign(new Member(), { roles: ["owner"], status: "ACTIVE" }),
        );
        RequestContext.set(Workspace, new Workspace());
        Object.assign(requireMember(), {
          user: RequestContext.get(User),
          workspace: RequestContext.get(Workspace),
        });
        RequestContext.set(
          API_KEY,
          Object.assign(new UserApiKey(), {
            permissions: ["user:read", "workspace:read"],
          }),
        );
        RequestContext.set(
          AuthAbility,
          new AuthAbility([
            { action: "delete", subject: User },
            { action: "delete", subject: Workspace },
          ]),
        );
        const refresh = () => {
          RequestIdentity.refresh(options);
        };
        if (failure) expect(refresh).toThrow("Invalid ability configuration");
        else refresh();
        expect(RequestContext.get(AuthAbility)?.can("delete", User)).toBe(
          false,
        );
        expect(RequestContext.get(AuthAbility)?.can("delete", Workspace)).toBe(
          false,
        );
        expect(RequestContext.get(AuthAbility)?.can("read", User)).toBe(
          !failure,
        );
        expect(RequestContext.get(AuthAbility)?.can("read", Workspace)).toBe(
          !failure,
        );
      });
    },
  );
});
function requireMember(): Member {
  const member = RequestContext.get(Member);
  assert(member);
  return member;
}
