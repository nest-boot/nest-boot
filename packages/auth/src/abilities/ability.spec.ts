import { AbilityBuilder } from "@casl/ability";
import { RequestContext } from "@nest-boot/request-context";

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
