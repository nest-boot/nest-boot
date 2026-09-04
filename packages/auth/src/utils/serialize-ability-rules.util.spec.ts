import { AbilityBuilder } from "@casl/ability";

import { UserAbility } from "../abilities/user.ability.js";
import { serializeAbilityRules } from "./serialize-ability-rules.util.js";

class Project {}

describe("serializeAbilityRules", () => {
  it("serializes class subjects and preserves conditional rule data", () => {
    const { can, cannot, build } = new AbilityBuilder(UserAbility);
    can(["read", "update"], Project, ["name"], { ownerId: "user-1" });
    cannot("delete", Project).because("Projects are retained");

    expect(serializeAbilityRules(build())).toEqual([
      {
        action: ["read", "update"],
        subject: "Project",
        conditions: { ownerId: "user-1" },
        fields: ["name"],
      },
      {
        action: "delete",
        subject: "Project",
        inverted: true,
        reason: "Projects are retained",
      },
    ]);
  });

  it("keeps string subjects unchanged", () => {
    const { can, build } = new AbilityBuilder(UserAbility);
    can("manage", "all");

    expect(serializeAbilityRules(build())).toEqual([
      { action: "manage", subject: "all" },
    ]);
  });
});
