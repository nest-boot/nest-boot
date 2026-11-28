import type { AbilityBuilder } from "@casl/ability";
import { expectTypeOf } from "vitest";

import type {
  AuthAbility,
  BuildAbilityContext,
  PermissionName,
  RoleName,
} from "../index.js";
import { AuthModule } from "./auth.module.js";

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
  | "workspace-member:set-roles"
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
expectTypeOf(invalidRole).toEqualTypeOf<never>();
expectTypeOf(invalidPermission).toEqualTypeOf<never>();

AuthModule.forRoot({
  buildAbility: ({ builder, permissions }) => {
    expectTypeOf(builder).toEqualTypeOf<AbilityBuilder<AuthAbility>>();
    expectTypeOf<BuildAbilityContext["builder"]>().toEqualTypeOf<
      AbilityBuilder<AuthAbility>
    >();
    if (permissions.includes("report:read")) {
      builder.can("read", "Report").because("Readable reports");
    }
    // @ts-expect-error Effective permissions only accept declared catalog names.
    permissions.includes("report:delete");
    // @ts-expect-error The permission-binding argument was removed.
    builder.can({ user: "report:read" }, "read", "Report");
    expectTypeOf(builder.build()).toEqualTypeOf<AuthAbility>();
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
    enabled: true,
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
    enabled: true,
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
  workspace: { enabled: true, permissions: ["project:read"] },
  apiKey: {
    user: { defaultPermissions: ["user:read", "report:read", "project:read"] },
    workspace: { defaultPermissions: ["project:read"] },
  },
});
AuthModule.forRoot({
  user: { permissions: ["report:read"] },
  apiKey: {
    workspace: {
      // @ts-expect-error WorkspaceMember keys cannot carry user-only permissions.
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
  workspace: { enabled: true, permissions: ["project:read"] },
  buildAbility: ({
    builder: { can, cannot },
    user,
    workspace,
    member,
    permissions,
    userPermissions,
    workspacePermissions,
  }) => {
    if (permissions.includes("report:read")) {
      can("read", "Report");
    }
    if (permissions.includes("project:read")) {
      can("read", "Project");
    }
    can(["read", "update"], "Report", ["title"], { published: true }).because(
      "Published reports",
    );
    cannot("delete", "Report").because("Retain reports");
    // @ts-expect-error Unknown permission names must not broaden the configured catalog.
    permissions.includes("project:delete");
    expectTypeOf(user?.id).toExtend<string | undefined>();
    expectTypeOf(workspace?.id).toExtend<string | undefined>();
    expectTypeOf(member?.id).toExtend<string | undefined>();
    // @ts-expect-error The combined effective permission snapshot is readonly.
    permissions.push("report:read");
    // @ts-expect-error Effective permission snapshots are readonly.
    userPermissions.push("report:read");
    // @ts-expect-error The workspace source still does not contain user-only permissions.
    workspacePermissions.includes("report:read");
  },
});

/** Checks legacy-option rejection without executing the invalid module configuration. */
function removedApiKeyConfiguration() {
  AuthModule.forRoot({
    apiKey: {
      enabled: true,
      // @ts-expect-error use apiKey.workspace instead of the removed member configuration
      member: { enabled: true },
    },
  });
  AuthModule.forRoot({
    apiKey: {
      // @ts-expect-error use apiKey.system instead of the removed systemAccount configuration
      systemAccount: { enabled: true },
    },
  });
}
removedApiKeyConfiguration;

AuthModule.forRoot({
  admin: { enabled: true },
  apiKey: {
    enabled: true,
    system: {
      enabled: true,
      defaultPrefix: "machine_",
      defaultPermissions: ["user:read"],
      // @ts-expect-error system keys accept only the platform permission catalog
      allowedPermissions: ["report:read"],
    },
  },
});
