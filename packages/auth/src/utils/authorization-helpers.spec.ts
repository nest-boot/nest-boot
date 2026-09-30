import { RequestContext } from "@nest-boot/request-context";
import { ForbiddenException } from "@nestjs/common";

import { AuthAbility } from "../auth.ability.js";
import { User } from "../entities/user.entity.js";
import { RequestIdentity } from "../infrastructure/request-identity.js";
import { authorize } from "./authorize.util.js";
import { can } from "./can.util.js";
import { getAuthAbility } from "./get-auth-ability.util.js";

class TestSubject {}

describe("request ability helpers", () => {
  it.each(["context", "identity", "ability"])(
    "throws when %s is missing",
    async (missing) => {
      const check = () => {
        expect(() => can("read", TestSubject)).toThrow(ForbiddenException);
        expect(() => {
          authorize("read", TestSubject);
        }).toThrow(ForbiddenException);
        expect(() => getAuthAbility().rules).toThrow(ForbiddenException);
      };
      if (missing === "context") {
        check();
        return;
      }
      await RequestContext.run(new RequestContext({ type: "test" }), () => {
        if (missing !== "identity") RequestContext.set(User, new User());
        if (missing !== "ability")
          RequestContext.set(
            AuthAbility,
            new AuthAbility([{ action: "read", subject: TestSubject }]),
          );
        check();
      });
    },
  );
  it("evaluates object and field checks with the prepared ability", async () => {
    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      RequestContext.set(User, new User());
      RequestContext.set(
        AuthAbility,
        new AuthAbility([
          { action: "update", subject: TestSubject, fields: ["name"] },
        ]),
      );
      expect(can("update", TestSubject)).toBe(true);
      expect(can("update", new TestSubject(), "name")).toBe(true);
      expect(can("update", new TestSubject(), "secret")).toBe(false);
      expect(can("delete", TestSubject)).toBe(false);
      expect(() => {
        authorize("update", new TestSubject(), "name");
      }).not.toThrow();
      expect(() => {
        authorize("update", new TestSubject(), "secret");
      }).toThrow(ForbiddenException);
    });
  });
});

describe("request identity changes", () => {
  it("keeps checks request-local across overlapping requests", async () => {
    let releaseFirst!: () => void;
    const firstReady = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let releaseSecond!: () => void;
    const secondReady = new Promise<void>((resolve) => {
      releaseSecond = resolve;
    });
    const run = (action: string, wait: Promise<void>, signal: () => void) =>
      RequestContext.run(new RequestContext({ type: "test" }), async () => {
        RequestContext.set(User, new User());
        RequestContext.set(
          AuthAbility,
          new AuthAbility([{ action, subject: TestSubject }]),
        );
        signal();
        await wait;
        expect(can(action, TestSubject)).toBe(true);
        expect(can(action === "read" ? "write" : "read", TestSubject)).toBe(
          false,
        );
        expect(() => {
          authorize(action, TestSubject);
        }).not.toThrow();
      });
    await Promise.all([
      run("read", secondReady, releaseFirst),
      run("write", firstReady, releaseSecond),
    ]);
    expect(() => can("read", TestSubject)).toThrow(ForbiddenException);
    expect(() => {
      authorize("read", TestSubject);
    }).toThrow(ForbiddenException);
  });

  it("uses the replacement ability and stops exposing a revoked identity", async () => {
    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      RequestContext.set(User, new User());
      const initial = new AuthAbility([
        { action: "read", subject: TestSubject },
      ]);
      RequestContext.set(AuthAbility, initial);
      expect(can("read", TestSubject)).toBe(true);
      expect(getAuthAbility().rules).toBe(initial.rules);
      const replacement = new AuthAbility([
        { action: "write", subject: TestSubject },
      ]);
      RequestContext.set(AuthAbility, replacement);
      expect(can("read", TestSubject)).toBe(false);
      expect(() => {
        authorize("read", TestSubject);
      }).toThrow(ForbiddenException);
      expect(() => {
        authorize("write", TestSubject);
      }).not.toThrow();
      expect(getAuthAbility().rules).toBe(replacement.rules);
      RequestIdentity.stage({ user: null, apiKey: null });
      // A stale ability alone must not grant access after sign-out.
      RequestContext.set(AuthAbility, replacement);
      expect(() => can("write", TestSubject)).toThrow(ForbiddenException);
      expect(() => getAuthAbility().rules).toThrow(ForbiddenException);
    });
  });
});

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
      expect(handler).toHaveBeenCalledWith({ target: ability, ability, rules });
      unsubscribe();
      getAuthAbility().update([]);
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });
});
