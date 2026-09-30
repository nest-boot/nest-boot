import { createMongoAbility, subject } from "@casl/ability";

import { Invitation } from "../entities/invitation.entity.js";
import { Member } from "../entities/member.entity.js";
import { User } from "../entities/user.entity.js";
import { UserApiKey } from "../entities/user-api-key.entity.js";
import { Workspace } from "../entities/workspace.entity.js";
import { WorkspaceApiKey } from "../entities/workspace-api-key.entity.js";
import { serializeAbilityRules } from "../utils/serialize-ability-rules.util.js";
import { AuthAbilityFactory } from "./auth-ability.factory.js";

const buildUserPermissionAbility = (permissions: readonly string[]) =>
  AuthAbilityFactory.createAbility(
    {
      workspace: null,
      member: null,
      workspacePermissions: [],
      user: new User(),
      userPermissions: permissions,
    },
    {},
  );
const buildWorkspacePermissionAbility = (permissions: readonly string[]) =>
  AuthAbilityFactory.createAbility(
    {
      user: null,
      member: null,
      userPermissions: [],
      workspace: new Workspace(),
      workspacePermissions: permissions,
    },
    {},
  );

describe("permission ability builders", () => {
  it("denies the current member's status field while preserving profile and other member writes", () => {
    const workspace = Object.assign(new Workspace(), { id: "workspace-1" });
    const member = Object.assign(new Member(), { id: "member-1", workspace });
    const ability = AuthAbilityFactory.createAbility({
      user: new User(),
      workspace,
      member,
      userPermissions: [],
      workspacePermissions: ["member:write"],
    });
    const other = Object.assign(new Member(), { id: "member-2", workspace });
    expect(ability.can("write", member)).toBe(true);
    expect(ability.can("write", member, "status")).toBe(false);
    expect(ability.can("write", member, "name")).toBe(true);
    expect(ability.can("write", member, "email")).toBe(true);
    expect(ability.can("write", other, "status")).toBe(true);
    const clientAbility = createMongoAbility(serializeAbilityRules(ability));
    expect(
      clientAbility.can(
        "write",
        subject("Member", { id: member.id, workspaceId: workspace.id }),
        "status",
      ),
    ).toBe(false);
    expect(
      clientAbility.can(
        "write",
        subject("Member", { id: other.id, workspaceId: workspace.id }),
        "status",
      ),
    ).toBe(true);
  });

  it("matches configured resource prefixes exactly without case aliases", () => {
    const userAbility = buildUserPermissionAbility([
      "User:delete",
      "UserApiKey:create",
    ]);
    const workspaceAbility = buildWorkspacePermissionAbility([
      "Workspace:delete",
      "UserApiKey:create",
    ]);
    expect(userAbility.can("delete", User)).toBe(false);
    expect(userAbility.can("write", UserApiKey)).toBe(false);
    expect(workspaceAbility.can("delete", Workspace)).toBe(false);
    expect(workspaceAbility.can("write", WorkspaceApiKey)).toBe(false);
  });
  it("does not grant private user reads from ordinary membership or workspace permissions", () => {
    expect(buildUserPermissionAbility([]).can("read", User)).toBe(false);
    expect(
      buildWorkspacePermissionAbility(["user:read"]).can("read", User),
    ).toBe(false);
    for (const permission of ["user:read"]) {
      expect(buildUserPermissionAbility([permission]).can("read", User)).toBe(
        true,
      );
    }
  });
  it.each(["read", "write"])(
    "grants only the requested API-key %s action",
    (action) => {
      for (const build of [
        buildUserPermissionAbility,
        buildWorkspacePermissionAbility,
      ]) {
        const ability =
          build === buildUserPermissionAbility
            ? buildUserPermissionAbility([`user-api-key:${action}`])
            : buildWorkspacePermissionAbility([`workspace-api-key:${action}`]);
        for (const candidate of [
          "read",
          "write",
          "create",
          "update",
          "delete",
        ]) {
          expect(
            ability.can(
              candidate,
              build === buildUserPermissionAbility
                ? UserApiKey
                : WorkspaceApiKey,
            ),
          ).toBe(candidate === action);
        }
      }
    },
  );
  it("does not grant key management to an empty-permission API key", () => {
    const ability = buildUserPermissionAbility([]);
    for (const action of ["read", "create", "update", "delete"]) {
      expect(ability.can(action, UserApiKey)).toBe(false);
    }
  });
  it("builds user permissions independently of workspace membership", () => {
    const ability = buildUserPermissionAbility(["user:delete"]);

    expect(ability.can("read", User)).toBe(false);
    expect(ability.can("create", Workspace)).toBe(false);
    expect(ability.can("manage", UserApiKey)).toBe(false);
    expect(ability.can("delete", Workspace)).toBe(false);
    expect(ability.can("delete", User)).toBe(true);
  });

  it("does not build implicit workspace rules from an empty permission list", () => {
    const ability = buildWorkspacePermissionAbility([]);

    expect(ability.can("read", Workspace)).toBe(false);
    expect(ability.can("read", Member)).toBe(false);
    expect(ability.can("update", Workspace)).toBe(false);
  });

  it("builds workspace rules from permissions resolved by the guard", () => {
    const ability = buildWorkspacePermissionAbility([
      "workspace:update",
      "workspace:delete",
      "workspace-api-key:write",
    ]);

    expect(ability.can("write", WorkspaceApiKey)).toBe(true);
    expect(ability.can("read", WorkspaceApiKey)).toBe(false);
    expect(ability.can("delete", Workspace)).toBe(true);
    expect(ability.can("read", Invitation)).toBe(false);
    expect(ability.can("update", Workspace)).toBe(true);
  });

  it("only grants the supplied resolved permissions", () => {
    const ability = buildWorkspacePermissionAbility([
      "workspace:update",
      "member:write",
    ]);

    expect(ability.can("write", UserApiKey)).toBe(false);
    expect(ability.can("delete", Workspace)).toBe(false);
    expect(ability.can("update", Workspace)).toBe(true);
    expect(ability.can("write", Member)).toBe(true);
  });

  it("does not map custom actions onto built-in auth subjects", () => {
    const ability = buildWorkspacePermissionAbility(["workspace:publish"]);

    expect(ability.can("publish", Workspace)).toBe(false);
  });

  it("does not infer grants from differently cased permission strings", () => {
    const ability = buildWorkspacePermissionAbility(["workspace:PUBLISH"]);
    expect(ability.can("PUBLISH", Workspace)).toBe(false);
    expect(ability.can("publish", Workspace)).toBe(false);
  });
});
