import { PermissionAbilityBuilder } from "./permission.ability-builder.js";

class Post {}

describe("PermissionAbilityBuilder", () => {
  it("should build a CASL mongo ability", () => {
    const builder = new PermissionAbilityBuilder();

    builder.can("publish", Post);
    const ability = builder.build();

    expect(ability.can("publish", Post)).toBe(true);
    expect(ability.can("archive", Post)).toBe(false);
  });
});
