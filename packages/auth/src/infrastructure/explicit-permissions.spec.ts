import { Invitation } from "../entities/invitation.entity.js";
import { Member } from "../entities/member.entity.js";
import { User } from "../entities/user.entity.js";
import { UserApiKey } from "../entities/user-api-key.entity.js";
import { Workspace } from "../entities/workspace.entity.js";
import { WorkspaceApiKey } from "../entities/workspace-api-key.entity.js";
import {
  DEFAULT_USER_PERMISSIONS,
  DEFAULT_USER_ROLES,
} from "../user.constants.js";
import {
  DEFAULT_WORKSPACE_PERMISSIONS,
  DEFAULT_WORKSPACE_ROLES,
} from "../workspace.constants.js";
import { AuthAbilityFactory } from "./auth-ability.factory.js";

describe("explicit auth permission catalog", () => {
  it("contains 26 distinct, scoped permissions without legacy aliases", () => {
    const permissions = [
      ...DEFAULT_USER_PERMISSIONS,
      ...DEFAULT_WORKSPACE_PERMISSIONS,
    ];
    expect(permissions).toHaveLength(26);
    expect(new Set(permissions).size).toBe(26);
    expect(
      permissions.some((permission) => permission.startsWith("invitation:")),
    ).toBe(false);
    expect(permissions).not.toContain("user:get");
    expect(permissions).not.toContain("user:list");
    expect(permissions).not.toContain("session:delete");
    expect(
      permissions.some((permission) => permission.startsWith("api-key:")),
    ).toBe(false);
  });

  it("does not add baseline abilities to empty credentials", () => {
    const abilities = [
      AuthAbilityFactory.createUserAbility([], new User()),
      AuthAbilityFactory.createWorkspaceAbility([], new Workspace()),
    ];
    for (const ability of abilities) {
      for (const subject of [
        User,
        Member,
        Workspace,
        Invitation,
        UserApiKey,
        WorkspaceApiKey,
      ]) {
        for (const action of [
          "read",
          "write",
          "create",
          "update",
          "delete",
          "set-roles",
          "set-permissions",
        ]) {
          expect(ability.can(action, subject)).toBe(false);
        }
      }
    }
  });

  it.each([
    ["member", Member],
    ["workspace-api-key", WorkspaceApiKey],
  ] as const)(
    "keeps %s write independent from read and sensitive grants",
    (resource, subject) => {
      const ability = AuthAbilityFactory.createWorkspaceAbility(
        [`${resource}:write`],
        new Workspace(),
      );
      expect(ability.can("write", subject)).toBe(true);
      expect(ability.can("read", subject)).toBe(false);
      expect(ability.can("set-roles", subject)).toBe(false);
      expect(ability.can("set-permissions", subject)).toBe(false);
    },
  );

  it("uses member:invite for invitation management without granting member writes", () => {
    const ability = AuthAbilityFactory.createWorkspaceAbility(
      ["member:invite"],
      new Workspace(),
    );
    expect(ability.can("read", Invitation)).toBe(true);
    expect(ability.can("write", Invitation)).toBe(true);
    expect(ability.can("write", Member)).toBe(false);
    expect(ability.can("set-roles", Member)).toBe(false);
    expect(ability.can("set-permissions", Member)).toBe(false);
    const memberWriter = AuthAbilityFactory.createWorkspaceAbility(
      ["member:write"],
      new Workspace(),
    );
    expect(memberWriter.can("read", Invitation)).toBe(false);
    expect(memberWriter.can("write", Invitation)).toBe(false);
  });

  it("keeps personal and workspace key permissions separate", () => {
    const userAbility = AuthAbilityFactory.createUserAbility(
      ["user-api-key:write", "workspace-api-key:read"],
      new User(),
    );
    const workspaceAbility = AuthAbilityFactory.createWorkspaceAbility(
      ["user-api-key:write", "workspace-api-key:read"],
      new Workspace(),
    );
    expect(userAbility.can("write", UserApiKey)).toBe(true);
    expect(userAbility.can("read", UserApiKey)).toBe(false);
    expect(workspaceAbility.can("write", WorkspaceApiKey)).toBe(false);
    expect(workspaceAbility.can("read", WorkspaceApiKey)).toBe(true);
  });

  it("retains object restrictions for invitation management", () => {
    const ability = AuthAbilityFactory.createWorkspaceAbility(
      ["member:invite"],
      new Workspace(),
      {
        buildAbility({ cannot }) {
          cannot("write", Invitation, { status: "accepted" });
        },
      },
    );
    expect(
      ability.can(
        "write",
        Object.assign(new Invitation(), { status: "pending" }),
      ),
    ).toBe(true);
    expect(
      ability.can(
        "write",
        Object.assign(new Invitation(), { status: "accepted" }),
      ),
    ).toBe(false);
    expect(
      ability.can(
        "read",
        Object.assign(new Invitation(), { status: "accepted" }),
      ),
    ).toBe(true);
    expect(ability.can("write", "Invitation")).toBe(true);
  });

  it("grants workspace creation explicitly through the user catalog", () => {
    const ability = AuthAbilityFactory.createUserAbility(
      ["workspace:create"],
      new User(),
    );
    expect(ability.can("create", Workspace)).toBe(true);
    expect(ability.can("read", Workspace)).toBe(false);
    expect(DEFAULT_USER_ROLES.user).toContain("workspace:create");
  });

  it("gives ordinary members explicit workspace/member reads, not invitation access", () => {
    expect(DEFAULT_WORKSPACE_ROLES.member).toEqual([
      "workspace:read",
      "member:read",
    ]);
    expect(DEFAULT_WORKSPACE_ROLES.admin).toContain("member:invite");
    expect(DEFAULT_WORKSPACE_ROLES.admin).not.toContain("workspace:delete");
  });
});
