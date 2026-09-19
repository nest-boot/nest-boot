import { RequestContext } from "@nest-boot/request-context";

import { UserAbility } from "../abilities/user.ability.js";
import { WorkspaceAbility } from "../abilities/workspace.ability.js";
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
        user: {
          roles: { admin: ["user:get", "user:delete"] },
        },
        workspace: {
          roles: { owner: ["workspace:read", "workspace:delete"] },
          buildAbility: () => {
            if (failure) throw new Error("Invalid ability configuration");
          },
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
        RequestContext.set(
          API_KEY,
          Object.assign(new UserApiKey(), {
            permissions: ["user:get", "workspace:read"],
          }),
        );
        RequestContext.set(
          UserAbility,
          new UserAbility([{ action: "delete", subject: User }]),
        );
        RequestContext.set(
          WorkspaceAbility,
          new WorkspaceAbility([{ action: "delete", subject: Workspace }]),
        );
        const refresh = () => {
          RequestIdentity.refresh(options);
        };
        if (failure) expect(refresh).toThrow("Invalid ability configuration");
        else refresh();
        expect(RequestContext.get(UserAbility)?.can("delete", User)).toBe(
          false,
        );
        expect(
          RequestContext.get(WorkspaceAbility)?.can("delete", Workspace),
        ).toBe(false);
        expect(RequestContext.get(UserAbility)?.can("read", User)).toBe(
          !failure,
        );
        expect(
          RequestContext.get(WorkspaceAbility)?.can("read", Workspace),
        ).toBe(!failure);
      });
    },
  );
});
