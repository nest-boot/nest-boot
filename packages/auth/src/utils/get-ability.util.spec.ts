import { RequestContext } from "@nest-boot/request-context";
import { ForbiddenException } from "@nestjs/common";

import { AuthAbility } from "../abilities/auth.ability.js";
import { User, WorkspaceApiKey } from "../entities/index.js";
import { RequestIdentity } from "../infrastructure/request-identity.js";
import { getAbility } from "./get-ability.util.js";

describe("getAbility", () => {
  it("rejects access outside a request", () => {
    expect(() => getAbility()).toThrow(ForbiddenException);
  });
  it.each(["identity", "ability"])("rejects a missing %s", async (missing) => {
    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      if (missing !== "identity") RequestContext.set(User, new User());
      if (missing !== "ability")
        RequestContext.set(AuthAbility, new AuthAbility());
      expect(() => getAbility()).toThrow(ForbiddenException);
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
        expect(getAbility()).toBe(ability);
        RequestIdentity.stage({ user: null, apiKey: null });
        RequestContext.set(AuthAbility, ability);
        expect(() => getAbility()).toThrow(ForbiddenException);
      });
    },
  );
});
