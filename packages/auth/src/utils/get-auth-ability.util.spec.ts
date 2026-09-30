import { RequestContext } from "@nest-boot/request-context";
import { ForbiddenException } from "@nestjs/common";

import { AuthAbility } from "../auth.ability.js";
import { User, WorkspaceApiKey } from "../entities/index.js";
import { RequestIdentity } from "../infrastructure/request-identity.js";
import { getAuthAbility } from "./get-auth-ability.util.js";

describe("getAuthAbility().rules", () => {
  it("rejects access outside a request", () => {
    expect(() => getAuthAbility().rules).toThrow(ForbiddenException);
  });
  it.each(["identity", "ability"])("rejects a missing %s", async (missing) => {
    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      if (missing !== "identity") RequestContext.set(User, new User());
      if (missing !== "ability")
        RequestContext.set(AuthAbility, new AuthAbility());
      expect(() => getAuthAbility().rules).toThrow(ForbiddenException);
    });
  });
  it.each(["user", "workspace-key"])(
    "reads the %s ability directly without a service",
    async (identity) => {
      await RequestContext.run(new RequestContext({ type: "test" }), () => {
        RequestIdentity.stage(
          identity === "user"
            ? { user: new User() }
            : { apiKey: new WorkspaceApiKey() },
        );
        const ability = new AuthAbility();
        RequestContext.set(AuthAbility, ability);
        expect(getAuthAbility().rules).toBe(ability.rules);
        RequestIdentity.stage({ user: null, apiKey: null });
        RequestContext.set(AuthAbility, ability);
        expect(() => getAuthAbility().rules).toThrow(ForbiddenException);
      });
    },
  );
});
