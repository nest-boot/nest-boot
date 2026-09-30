import { AbilityBuilder } from "@casl/ability";
import { RequestContext } from "@nest-boot/request-context";
import { ForbiddenException } from "@nestjs/common";

import { AuthAbility } from "./auth.ability.js";
class Post {}
describe("AuthAbility", () => {
  it("supports Mongo conditions and field restrictions", () => {
    const builder = new AbilityBuilder(AuthAbility);
    builder.can("publish", Post, ["title"], { authorId: "user-1" });
    const ability = builder.build();
    expect(ability).toBeInstanceOf(AuthAbility);
    expect(
      ability.can(
        "publish",
        Object.assign(new Post(), { authorId: "user-1" }),
        "title",
      ),
    ).toBe(true);
    expect(
      ability.can(
        "publish",
        Object.assign(new Post(), { authorId: "user-2" }),
        "title",
      ),
    ).toBe(false);
    expect(
      ability.can(
        "publish",
        Object.assign(new Post(), { authorId: "user-1" }),
        "secret",
      ),
    ).toBe(false);
  });
  it("uses one request-context token", async () => {
    const ability = new AuthAbility();
    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      RequestContext.set(AuthAbility, ability);
      expect(RequestContext.get(AuthAbility)).toBe(ability);
    });
  });
});

describe("AuthAbility.throwUnlessCan", () => {
  it("checks conditions and fields directly without a request context", () => {
    const builder = new AbilityBuilder(AuthAbility);
    builder.can("update", Post, ["title"], { authorId: "user-1" });
    const ability = builder.build();
    const ownPost = Object.assign(new Post(), { authorId: "user-1" });
    const otherPost = Object.assign(new Post(), { authorId: "user-2" });
    expect(() => {
      ability.throwUnlessCan("update", ownPost);
    }).not.toThrow();
    expect(() => {
      ability.throwUnlessCan("update", ownPost, "title");
    }).not.toThrow();
    expect(() => {
      ability.throwUnlessCan("update", ownPost, "secret");
    }).toThrow(ForbiddenException);
    expect(() => {
      ability.throwUnlessCan("update", otherPost, "title");
    }).toThrow(ForbiddenException);
    try {
      ability.throwUnlessCan("delete", ownPost);
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getStatus()).toBe(403);
    }
  });
});
