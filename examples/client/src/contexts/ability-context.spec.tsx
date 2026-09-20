// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AbilityProvider, useAbility } from "./ability-context";
import type { SerializedAbilityRule } from "@/lib/ability";
import { createAbilitySubject } from "@/lib/ability";

const userRules: Array<SerializedAbilityRule> = [
  { actions: ["read"], subjects: ["User"], inverted: false },
];
function workspaceRules(id: string): Array<SerializedAbilityRule> {
  return [
    ...userRules,
    {
      actions: ["write"],
      subjects: ["Member"],
      conditions: { workspaceId: id },
      inverted: false,
    },
  ];
}
function Probe() {
  const ability = useAbility();
  return (
    <output>
      {JSON.stringify([
        ability.can("read", "User"),
        ability.can(
          "write",
          createAbilitySubject("Member", { workspaceId: "one" }),
        ),
        ability.can(
          "write",
          createAbilitySubject("Member", { workspaceId: "two" }),
        ),
      ])}
    </output>
  );
}

afterEach(cleanup);

describe("AbilityProvider", () => {
  it("replaces selected workspace rules and restores personal rules on exit", () => {
    function Page({ workspace }: { workspace?: string }) {
      return (
        <AbilityProvider rules={userRules}>
          {workspace ? (
            <AbilityProvider rules={workspaceRules(workspace)}>
              <Probe />
            </AbilityProvider>
          ) : (
            <Probe />
          )}
        </AbilityProvider>
      );
    }
    const view = render(<Page workspace="one" />);
    expect(screen.getByRole("status").textContent).toBe("[true,true,false]");
    view.rerender(<Page workspace="two" />);
    expect(screen.getByRole("status").textContent).toBe("[true,false,true]");
    view.rerender(<Page />);
    expect(screen.getByRole("status").textContent).toBe("[true,false,false]");
  });

  it("never falls back to a parent grant when the selected identity denies it", () => {
    render(
      <AbilityProvider rules={userRules}>
        <AbilityProvider rules={[]}>
          <Probe />
        </AbilityProvider>
      </AbilityProvider>,
    );
    expect(screen.getByRole("status").textContent).toBe("[false,false,false]");
  });
});
