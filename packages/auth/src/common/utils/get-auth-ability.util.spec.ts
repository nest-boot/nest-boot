import { RequestContext } from "@nest-boot/request-context";
import { ForbiddenException } from "@nestjs/common";

import { stageIdentity } from "../../../test/fixtures/auth-context.fixture.js";
import { ApiKey } from "../../api-key/entities/api-key.entity.js";
import { WorkspaceApiKey } from "../../api-key/objects/workspace-api-key.object.js";
import { User } from "../../core/entities/user.entity.js";
import { AuthAbility } from "../auth.ability.js";
import { getAuthAbility } from "./get-auth-ability.util.js";

describe("getAuthAbility().rules", () => {
  it("rejects access outside a request", () => {
    expect(() => getAuthAbility().rules).toThrow(ForbiddenException);
  });
  it.each(["identity", "ability"])("rejects a missing %s", async (missing) => {
    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      if (missing !== "identity") {
        RequestContext.set(User, new User());
      }
      if (missing !== "ability") {
        RequestContext.set(AuthAbility, new AuthAbility());
      }
      expect(() => getAuthAbility().rules).toThrow(ForbiddenException);
    });
  });
  it.each(["user", "member-key"])(
    "reads the %s ability directly without a service",
    async (identity) => {
      await RequestContext.run(new RequestContext({ type: "test" }), () => {
        stageIdentity(
          identity === "user"
            ? { user: new User() }
            : { apiKey: new WorkspaceApiKey(new ApiKey()) },
        );
        const ability = new AuthAbility();
        RequestContext.set(AuthAbility, ability);
        expect(getAuthAbility().rules).toBe(ability.rules);
        stageIdentity({ user: null, apiKey: null });
        RequestContext.set(AuthAbility, ability);
        expect(() => getAuthAbility().rules).toThrow(ForbiddenException);
      });
    },
  );
});

describe("request authorization helpers", () => {
  class TestSubject {}

  describe("explicit ability access", () => {
    it("returns the concrete instance with unchanged CASL event and update behavior", async () => {
      await RequestContext.run(new RequestContext({ type: "test" }), () => {
        RequestContext.set(User, new User());
        const ability = new AuthAbility();
        RequestContext.set(AuthAbility, ability);
        expect(getAuthAbility()).toBe(ability);
        const handler = vi.fn();
        const unsubscribe = getAuthAbility().on("updated", handler);
        const rules = [{ action: "read", subject: TestSubject }];
        expect(getAuthAbility().update(rules)).toBe(ability);
        expect(handler).toHaveBeenCalledWith({
          target: ability,
          ability,
          rules,
        });
        unsubscribe();
        getAuthAbility().update([]);
        expect(handler).toHaveBeenCalledTimes(1);
      });
    });
  });
});
