import { RequestContext } from "@nest-boot/request-context";
import { ForbiddenException } from "@nestjs/common";

import { AuthAbility, authAbility } from "./auth.ability.js";
import { User } from "./entities/user.entity.js";
import { RequestIdentity } from "./infrastructure/request-identity.js";
class TestSubject {}
describe("authAbility", () => {
  it("preserves ordinary object behavior without a request", () => {
    /* eslint-disable @typescript-eslint/no-base-to-string, no-prototype-builtins -- Exercise native object operations through the Proxy rather than bypassing its get trap. */
    expect(authAbility.constructor).toBe(AuthAbility);
    expect(authAbility instanceof AuthAbility).toBe(true);
    expect(String(authAbility)).toBe("[object Object]");
    expect(authAbility.valueOf()).toBe(authAbility);
    expect(authAbility.hasOwnProperty("constructor")).toBe(false);
    expect(authAbility.isPrototypeOf(new AuthAbility())).toBe(false);
    expect(authAbility.propertyIsEnumerable("constructor")).toBe(false);
    /* eslint-enable @typescript-eslint/no-base-to-string, no-prototype-builtins */
  });
  it.each(["context", "identity", "ability"])(
    "throws when %s is missing",
    async (missing) => {
      const check = () => {
        expect(() => authAbility.can("read", TestSubject)).toThrow(
          ForbiddenException,
        );
        expect(() => authAbility.cannot("read", TestSubject)).toThrow(
          ForbiddenException,
        );
        expect(() => {
          authAbility.throwUnlessCan("read", TestSubject);
        }).toThrow(ForbiddenException);
        expect(() => authAbility.rules).toThrow(ForbiddenException);
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
      expect(authAbility.can("update", TestSubject)).toBe(true);
      expect(authAbility.can("update", new TestSubject(), "name")).toBe(true);
      expect(authAbility.can("update", new TestSubject(), "secret")).toBe(
        false,
      );
      expect(authAbility.can("delete", TestSubject)).toBe(false);
    });
  });
});

describe("request forwarding", () => {
  it("keeps fluent results request-aware after replacement and sign-out", async () => {
    const result = await RequestContext.run(
      new RequestContext({ type: "test" }),
      () => {
        RequestContext.set(User, new User());
        RequestContext.set(AuthAbility, new AuthAbility());
        const updated = authAbility.update([
          { action: "read", subject: TestSubject },
        ]);
        expect(updated).toBe(authAbility);
        expect(updated.can("read", TestSubject)).toBe(true);

        RequestContext.set(
          AuthAbility,
          new AuthAbility([{ action: "write", subject: TestSubject }]),
        );
        expect(updated.can("read", TestSubject)).toBe(false);
        expect(updated.can("write", TestSubject)).toBe(true);

        RequestIdentity.stage({ user: null, apiKey: null });
        expect(() => updated.can("write", TestSubject)).toThrow(
          ForbiddenException,
        );
        return updated;
      },
    );
    expect(() => result.can("read", TestSubject)).toThrow(ForbiddenException);
  });
  it("keeps destructured methods request-local across overlapping requests", async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method -- Verify the Proxy supports destructured calls.
    const { can, cannot, throwUnlessCan } = authAbility;
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
        expect(cannot(action === "read" ? "write" : "read", TestSubject)).toBe(
          true,
        );
        expect(() => {
          throwUnlessCan(action, TestSubject);
        }).not.toThrow();
      });
    await Promise.all([
      run("read", secondReady, releaseFirst),
      run("write", firstReady, releaseSecond),
    ]);
    expect(() => can("read", TestSubject)).toThrow(ForbiddenException);
    expect(() => cannot("read", TestSubject)).toThrow(ForbiddenException);
    expect(() => {
      throwUnlessCan("read", TestSubject);
    }).toThrow(ForbiddenException);
  });

  it("uses the replacement ability and stops exposing a revoked identity", async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method -- Verify calls resolve the replacement request ability.
    const { can, throwUnlessCan } = authAbility;
    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      RequestContext.set(User, new User());
      const initial = new AuthAbility([
        { action: "read", subject: TestSubject },
      ]);
      RequestContext.set(AuthAbility, initial);
      expect(can("read", TestSubject)).toBe(true);
      expect(authAbility.rules).toBe(initial.rules);
      const replacement = new AuthAbility([
        { action: "write", subject: TestSubject },
      ]);
      RequestContext.set(AuthAbility, replacement);
      expect(can("read", TestSubject)).toBe(false);
      expect(() => {
        throwUnlessCan("read", TestSubject);
      }).toThrow(ForbiddenException);
      expect(() => {
        throwUnlessCan("write", TestSubject);
      }).not.toThrow();
      expect(authAbility.rules).toBe(replacement.rules);
      RequestIdentity.stage({ user: null, apiKey: null });
      // A stale ability alone must not grant access after sign-out.
      RequestContext.set(AuthAbility, replacement);
      expect(() => can("write", TestSubject)).toThrow(ForbiddenException);
      expect(() => authAbility.rules).toThrow(ForbiddenException);
    });
  });

  it("binds CASL methods to the current instance", async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method -- Verify CASL methods receive their actual ability instance.
    const { update, relevantRuleFor } = authAbility;
    expect(() => update([])).toThrow(ForbiddenException);
    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      RequestContext.set(User, new User());
      const ability = new AuthAbility();
      RequestContext.set(AuthAbility, ability);
      const rules = [{ action: "read", subject: TestSubject }];
      update(rules);
      expect(ability.rules).toBe(rules);
      expect(relevantRuleFor("read", TestSubject)).toBe(
        ability.relevantRuleFor("read", TestSubject),
      );
    });
  });
});
