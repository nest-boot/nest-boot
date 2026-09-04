import { AbilityBuilder } from "@casl/ability";
import { RequestContext } from "@nest-boot/request-context";

import { UserAbility } from "./user.ability.js";
import { WorkspaceAbility } from "./workspace.ability.js";

class Post {}

describe("scoped abilities", () => {
  it("builds a UserAbility with its matching builder", () => {
    const builder = new AbilityBuilder(UserAbility);
    builder.can("publish", Post, { authorId: "user-1" });

    const ability = builder.build();
    const ownPost = Object.assign(new Post(), { authorId: "user-1" });
    const otherPost = Object.assign(new Post(), { authorId: "user-2" });

    expect(ability).toBeInstanceOf(UserAbility);
    expect(ability).not.toBeInstanceOf(WorkspaceAbility);
    expect(ability.can("publish", ownPost)).toBe(true);
    expect(ability.can("publish", otherPost)).toBe(false);
  });

  it("builds a WorkspaceAbility with its matching builder", () => {
    const builder = new AbilityBuilder(WorkspaceAbility);
    builder.can("archive", Post);

    const ability = builder.build();

    expect(ability).toBeInstanceOf(WorkspaceAbility);
    expect(ability).not.toBeInstanceOf(UserAbility);
    expect(ability.can("archive", Post)).toBe(true);
  });

  it("uses each ability class as its own request-context token", async () => {
    const userAbility = new UserAbility();
    const workspaceAbility = new WorkspaceAbility();

    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      RequestContext.set(UserAbility, userAbility);
      RequestContext.set(WorkspaceAbility, workspaceAbility);

      expect(RequestContext.get(UserAbility)).toBe(userAbility);
      expect(RequestContext.get(WorkspaceAbility)).toBe(workspaceAbility);
    });
  });
});
