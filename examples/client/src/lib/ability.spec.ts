import { describe, expect, it } from "vitest";

import { createAbility, createAbilitySubject } from "./ability";

describe("createAbility", () => {
  it("rehydrates actions, subjects, conditions, and inverted rules", () => {
    const ability = createAbility([
      {
        actions: ["read", "update"],
        subjects: ["Project"],
        conditions: { ownerId: "user-1" },
        inverted: false,
      },
      {
        actions: ["delete"],
        subjects: ["Project"],
        inverted: true,
        reason: "Projects are retained",
      },
    ]);

    expect(
      ability.can(
        "update",
        createAbilitySubject("Project", { ownerId: "user-1" }),
      ),
    ).toBe(true);
    expect(
      ability.can(
        "update",
        createAbilitySubject("Project", { ownerId: "user-2" }),
      ),
    ).toBe(false);
    expect(ability.can("delete", "Project")).toBe(false);
  });

  it("does not mutate immutable API results", () => {
    const value = Object.freeze({ ownerId: "user-1" });

    expect(createAbilitySubject("Project", value)).not.toBe(value);
    expect(value).toEqual({ ownerId: "user-1" });
  });
});
