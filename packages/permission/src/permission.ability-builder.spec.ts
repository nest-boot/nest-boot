import { PermissionAction } from "./enums/permission-action.enum";
import { PermissionAbilityBuilder } from "./permission.ability-builder";

class Post {}

describe("PermissionAbilityBuilder", () => {
  it("should build a CASL mongo ability", () => {
    const builder = new PermissionAbilityBuilder();

    builder.can(PermissionAction.READ, Post);
    const ability = builder.build();

    expect(ability.can(PermissionAction.READ, Post)).toBe(true);
    expect(ability.can(PermissionAction.DELETE, Post)).toBe(false);
  });
});
