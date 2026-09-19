import { Invitation } from "../entities/invitation.entity.js";
import { Member } from "../entities/member.entity.js";
import { User } from "../entities/user.entity.js";
import { UserApiKey } from "../entities/user-api-key.entity.js";
import { Workspace } from "../entities/workspace.entity.js";
import { WorkspaceApiKey } from "../entities/workspace-api-key.entity.js";
import { AuthAbilityFactory } from "./auth-ability.factory.js";

const buildUserPermissionAbility = (permissions: readonly string[]) =>
  AuthAbilityFactory.createUserAbility(permissions, new User());
const buildWorkspacePermissionAbility = (permissions: readonly string[]) =>
  AuthAbilityFactory.createWorkspaceAbility(permissions, new Workspace());

describe("permission ability builders", () => {
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
    expect(userAbility.can("create", UserApiKey)).toBe(false);
    expect(workspaceAbility.can("delete", Workspace)).toBe(false);
    expect(workspaceAbility.can("create", WorkspaceApiKey)).toBe(false);
  });
  it("does not grant private user reads from ordinary membership or workspace permissions", () => {
    expect(buildUserPermissionAbility([]).can("read", User)).toBe(false);
    expect(
      buildWorkspacePermissionAbility(["user:get", "user:read"]).can(
        "read",
        User,
      ),
    ).toBe(false);
    for (const permission of ["user:get", "user:list"]) {
      expect(buildUserPermissionAbility([permission]).can("read", User)).toBe(
        true,
      );
    }
  });
  it.each(["read", "create", "update", "delete"])(
    "grants only the requested API-key %s action",
    (action) => {
      for (const build of [
        buildUserPermissionAbility,
        buildWorkspacePermissionAbility,
      ]) {
        const ability =
          build === buildUserPermissionAbility
            ? buildUserPermissionAbility([`api-key:${action}`])
            : buildWorkspacePermissionAbility([`api-key:${action}`]);
        for (const candidate of ["read", "create", "update", "delete"]) {
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
    expect(ability.can("create", Workspace)).toBe(true);
    expect(ability.can("manage", UserApiKey)).toBe(false);
    expect(ability.can("delete", Workspace)).toBe(false);
    expect(ability.can("delete", User)).toBe(true);
  });

  it("builds baseline workspace rules from an empty resolved permission list", () => {
    const ability = buildWorkspacePermissionAbility([]);

    expect(ability.can("read", Workspace)).toBe(true);
    expect(ability.can("read", Member)).toBe(true);
    expect(ability.can("update", Workspace)).toBe(false);
  });

  it("builds workspace rules from permissions resolved by the guard", () => {
    const ability = buildWorkspacePermissionAbility([
      "workspace:update",
      "workspace:delete",
      "api-key:create",
      "api-key:update",
      "api-key:delete",
    ]);

    expect(ability.can("create", WorkspaceApiKey)).toBe(true);
    expect(ability.can("update", WorkspaceApiKey)).toBe(true);
    expect(ability.can("delete", WorkspaceApiKey)).toBe(true);
    expect(ability.can("delete", Workspace)).toBe(true);
    expect(ability.can("read", Invitation)).toBe(true);
    expect(ability.can("update", Workspace)).toBe(true);
  });

  it("only grants the supplied resolved permissions", () => {
    const ability = buildWorkspacePermissionAbility([
      "workspace:update",
      "member:update",
    ]);

    expect(ability.can("create", UserApiKey)).toBe(false);
    expect(ability.can("delete", Workspace)).toBe(false);
    expect(ability.can("update", Workspace)).toBe(true);
    expect(ability.can("update", Member)).toBe(true);
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
