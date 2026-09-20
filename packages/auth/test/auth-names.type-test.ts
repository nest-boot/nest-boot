import { expectTypeOf } from "vitest";

import { AuthModule } from "../src/auth.module.js";
import type { PermissionName, RoleName } from "../src/index.js";

// Checked by the auth typecheck task, not by the runtime test runner.
type ValidRoles = "owner" | "admin" | "super-admin" | "level2" | "a";
type InvalidRoles =
  | ""
  | "Owner"
  | "ADMIN"
  | "team_admin"
  | "super--admin"
  | "super---admin"
  | "2admin"
  | "_admin"
  | "admin "
  | " admin"
  | "ad min"
  | "admin\n"
  | "user:read"
  | "équipe"
  | "管理员"
  | "true"
  | "false"
  | "null"
  | "__type";

expectTypeOf<RoleName<ValidRoles>>().toEqualTypeOf<ValidRoles>();
expectTypeOf<RoleName<InvalidRoles>>().toEqualTypeOf<never>();
expectTypeOf<RoleName<"owner" | "Owner">>().toEqualTypeOf<"owner">();
expectTypeOf<RoleName<string>>().toEqualTypeOf<never>();
expectTypeOf<RoleName<`admin${string}`>>().toEqualTypeOf<never>();
expectTypeOf<RoleName<never>>().toEqualTypeOf<never>();

type ValidPermissions =
  | "user:read"
  | "user-api-key:read"
  | "user:set-roles"
  | "workspace-api-key:write"
  | "member:set-roles"
  | "resource2:action3"
  | "true:false"
  | "null:read";
type InvalidPermissions =
  | ""
  | "read"
  | "User:read"
  | "user:Read"
  | "user:"
  | ":read"
  | "user:read:extra"
  | "user :read"
  | "user:read "
  | "user:read\n"
  | "2user:read"
  | "user:2read"
  | "-user:read"
  | "user:_read"
  | "用户:read"
  | "user:读取"
  | "user:*"
  | "user_api_key:read"
  | "user:set_role";
type ConsecutiveHyphenPermissions =
  | "api--key:read"
  | "api---key:read"
  | "user:set--role"
  | "user:set---role";
expectTypeOf<
  PermissionName<ConsecutiveHyphenPermissions>
>().toEqualTypeOf<never>();

expectTypeOf<
  PermissionName<ValidPermissions>
>().toEqualTypeOf<ValidPermissions>();
expectTypeOf<PermissionName<InvalidPermissions>>().toEqualTypeOf<never>();
expectTypeOf<
  PermissionName<"user-api-key:read" | "user:Read">
>().toEqualTypeOf<"user-api-key:read">();
expectTypeOf<PermissionName<string>>().toEqualTypeOf<never>();
expectTypeOf<PermissionName<`user:${string}`>>().toEqualTypeOf<never>();
expectTypeOf<PermissionName<`${string}:read`>>().toEqualTypeOf<never>();
expectTypeOf<PermissionName<never>>().toEqualTypeOf<never>();

// @ts-expect-error Uppercase role literals must not be assignable.
const invalidRole: RoleName<"Owner"> = "Owner";
// @ts-expect-error Permission segments must both be nonempty.
const invalidPermission: PermissionName<"user:"> = "user:";
void invalidRole;
void invalidPermission;

AuthModule.forRoot({
  buildAbility: (rules) => {
    rules.can({ user: "report:read" }, "read", "Report");
    // @ts-expect-error A rule must bind to a declared permission.
    rules.can({ user: "report:delete" }, "delete", "Report");
    // @ts-expect-error The raw builder is not an extension point.
    rules.build();
  },

  user: {
    permissions: ["report:read"],
    roles: {
      "super-admin": ["report:read", "user:read"],
      admin: ["report:read"],
    },
    defaultRole: "super-admin",
    adminRoles: ["super-admin"],
  },
  workspace: {
    permissions: ["workspace-api-key:write"],
    roles: { "team-owner": ["workspace-api-key:write", "workspace:update"] },
    creatorRole: "team-owner",
    defaultRole: "team-owner",
  },
  apiKey: {
    user: {
      allowedPermissions: [
        "report:read",
        "workspace-api-key:write",
        "user:read",
      ],
    },
  },
});

AuthModule.forRoot({
  user: {
    // @ts-expect-error Invalid permission names cannot enter the catalog.
    permissions: ["Report:read"],
  },
});
AuthModule.forRoot({
  user: {
    // @ts-expect-error Role keys must be GraphQL-safe lowercase identifiers.
    roles: { Admin: [] },
  },
});
AuthModule.forRoot({
  workspace: {
    roles: { leader: [], guest: [] },
    // @ts-expect-error The creator role must reference a configured key.
    creatorRole: "missing-role",
  },
});
AuthModule.forRoot({
  user: {
    permissions: ["report:read"],
    // @ts-expect-error Role grants must come from the configured catalog.
    roles: { reader: ["report:write"] },
  },
});
AuthModule.forRootAsync({
  useFactory: () => ({
    user: {
      permissions: ["report:read"],
      roles: { "super-admin": ["report:read"] },
      defaultRole: "super-admin",
      adminRoles: ["super-admin"],
    },
  }),
});
AuthModule.forRootAsync({
  // @ts-expect-error Async configuration must check lifecycle roles too.
  useFactory: () => ({
    user: {
      roles: { reader: [] },
      defaultRole: "owner",
    },
  }),
});

AuthModule.forRoot({
  user: {
    // @ts-expect-error Underscores are not allowed in role names.
    roles: { super_admin: [] },
  },
});
AuthModule.forRoot({
  user: {
    // @ts-expect-error Underscores are not allowed in permission names.
    permissions: ["user_api_key:read"],
  },
});
AuthModule.forRootAsync({
  // @ts-expect-error Async catalogs must also reject uppercase permissions.
  useFactory: () => ({ user: { permissions: ["User:read"] } }),
});
AuthModule.forRootAsync({
  // @ts-expect-error Async role keys must also reject underscores.
  useFactory: () => ({ user: { roles: { super_admin: [] } } }),
});

declare const dynamicPermission: string;
AuthModule.forRoot({
  user: { permissions: ["report:read"] },
  workspace: { permissions: ["project:read"] },
  apiKey: {
    user: { defaultPermissions: ["user:read", "report:read", "project:read"] },
    workspace: { defaultPermissions: ["project:read"] },
  },
});
AuthModule.forRoot({
  user: { permissions: ["report:read"] },
  apiKey: {
    workspace: {
      // @ts-expect-error Workspace keys cannot carry user-only permissions.
      defaultPermissions: ["report:read"],
    },
  },
});
AuthModule.forRoot({
  apiKey: {
    // @ts-expect-error Flat API-key permission settings have been removed.
    defaultPermissions: [],
  },
});
declare const dynamicRole: string;
AuthModule.forRoot({
  user: {
    permissions: [dynamicPermission],
    roles: { [dynamicRole]: [dynamicPermission] },
    defaultRole: dynamicRole,
    adminRoles: [dynamicRole],
  },
});
AuthModule.forRoot({
  user: { permissions: ["report:read"] },
  workspace: { permissions: ["project:read"] },
  buildAbility: (
    { can },
    { user, workspace, member, userPermissions, workspacePermissions },
  ) => {
    can({ user: "report:read" }, "read", "Report");
    can({ workspace: "project:read" }, "read", "Project");
    // @ts-expect-error User grants cannot bind a workspace-only permission.
    can({ user: "project:read" }, "read", "Project");
    // @ts-expect-error Exactly one permission source is required.
    can({ user: "report:read", workspace: "project:read" }, "read", "Report");
    // @ts-expect-error Source inference must not broaden the configured catalog.
    can({ workspace: "project:delete" }, "delete", "Project");
    void [user?.id, workspace?.id, member?.id];
    // @ts-expect-error Effective permission snapshots are readonly.
    userPermissions.push("report:read");
    // @ts-expect-error The workspace array does not contain user-only permissions.
    workspacePermissions.includes("report:read");
  },
});
