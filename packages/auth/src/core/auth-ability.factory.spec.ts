import { createMongoAbility, subject } from "@casl/ability";

import { withAuthTestFeatures } from "../../test/fixtures/enabled-auth-features.fixture.js";
import { SystemAccount } from "../api-key/entities/system-account.entity.js";
import { UserApiKey } from "../api-key/objects/user-api-key.object.js";
import { WorkspaceApiKey } from "../api-key/objects/workspace-api-key.object.js";
import { resolveApiKeyPermissionCatalog } from "../api-key/utils/api-key-permissions.util.js";
import { resolveAuthCatalog } from "../common/utils/resolve-auth-catalog.util.js";
import { serializeAbilityRules } from "../common/utils/serialize-ability-rules.util.js";
import {
  DEFAULT_WORKSPACE_PERMISSIONS,
  DEFAULT_WORKSPACE_ROLES,
} from "../workspace/constants/workspace.constants.js";
import { Invitation } from "../workspace/entities/invitation.entity.js";
import { Member } from "../workspace/entities/member.entity.js";
import { Workspace } from "../workspace/entities/workspace.entity.js";
import { AuthAbilityFactory } from "./auth-ability.factory.js";
import {
  DEFAULT_USER_PERMISSIONS,
  DEFAULT_USER_ROLES,
} from "./constants/user.constants.js";
import { User } from "./entities/user.entity.js";
import { type AuthModuleOptions } from "./interfaces/auth-module-options.interface.js";

const buildUserPermissionAbility = (permissions: readonly string[]) =>
  AuthAbilityFactory.createAbility(
    {
      workspace: null,
      member: null,
      workspacePermissions: [],
      user: new User(),
      userPermissions: permissions,
    },
    withAuthTestFeatures({ workspace: { enabled: true } }),
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
    withAuthTestFeatures({ workspace: { enabled: true } }),
  );

describe("permission ability builders", () => {
  it("keeps machine platform grants independent from human administrative features", () => {
    const options = { apiKey: { enabled: true, system: { enabled: true } } };
    const context = {
      user: null,
      systemAccount: new SystemAccount(),
      workspace: null,
      member: null,
      userPermissions: ["user:read", "workspace:read-any", "user:set-roles"],
      workspacePermissions: [],
    };
    const machine = AuthAbilityFactory.createAbility(context, options);
    expect(machine.can("read", User)).toBe(true);
    expect(machine.can("read-any", Workspace)).toBe(false);
    const workspaceMachine = AuthAbilityFactory.createAbility(context, {
      ...options,
      workspace: { enabled: true },
    });
    expect(workspaceMachine.can("read-any", Workspace)).toBe(true);
    expect(machine.can("set-roles", User)).toBe(false);
    const human = AuthAbilityFactory.createAbility(
      { ...context, user: new User(), systemAccount: null },
      options,
    );
    expect(human.can("read", User)).toBe(false);
    const disabled = AuthAbilityFactory.createAbility(context, {
      apiKey: { enabled: false, system: { enabled: true } },
    });
    expect(disabled.can("read", User)).toBe(false);
  });
  it("suppresses disabled framework grants while preserving configured business grants", () => {
    const ability = AuthAbilityFactory.createAbility(
      {
        user: new User(),
        member: null,
        workspace: null,
        userPermissions: [...DEFAULT_USER_PERMISSIONS, "project:read"],
        workspacePermissions: [],
      },
      {
        user: { permissions: ["project:read"] },
        buildAbility: (rules) => {
          rules.can({ user: "project:read" }, "read", "Project");
        },
      },
    );
    expect(ability.can("read", User)).toBe(false);
    expect(ability.can("write", UserApiKey)).toBe(false);
    expect(ability.can("read", "SystemAccount")).toBe(false);
    expect(ability.can("read", "Project")).toBe(true);
  });
  it("denies the current member's status field while preserving profile and other member writes", () => {
    const workspace = Object.assign(new Workspace(), { id: "workspace-1" });
    const member = Object.assign(new Member(), { id: "member-1", workspace });
    const ability = AuthAbilityFactory.createAbility(
      {
        user: new User(),
        workspace,
        member,
        userPermissions: [],
        workspacePermissions: ["member:write"],
      },
      withAuthTestFeatures({ workspace: { enabled: true } }),
    );
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
        subject("Member", {
          id: member.id,
          workspaceId: workspace.id,
          type: "USER",
        }),
        "status",
      ),
    ).toBe(false);
    expect(
      clientAbility.can(
        "write",
        subject("Member", {
          id: other.id,
          workspaceId: workspace.id,
          type: "USER",
        }),
        "status",
      ),
    ).toBe(true);
  });
  it.each(["read", "write"])(
    "separates service account %s from user membership",
    (action) => {
      const workspace = Object.assign(new Workspace(), { id: "workspace-1" });
      const userMember = Object.assign(new Member(), { workspace });
      const serviceAccount = Object.assign(new Member(), {
        workspace,
        type: "SERVICE_ACCOUNT",
      });
      const outside = Object.assign(new Member(), {
        workspace: Object.assign(new Workspace(), { id: "workspace-2" }),
        type: "SERVICE_ACCOUNT",
      });
      const build = (permissions: string[]) =>
        AuthAbilityFactory.createAbility(
          {
            user: null,
            member: null,
            workspace,
            userPermissions: [],
            workspacePermissions: permissions,
          },
          withAuthTestFeatures({ workspace: { enabled: true } }),
        );
      const memberAbility = build([`member:${action}`]);
      expect(memberAbility.can(action, userMember)).toBe(true);
      expect(memberAbility.can(action, serviceAccount)).toBe(false);
      const serviceAbility = build([`service-account:${action}`]);
      expect(serviceAbility.can(action, serviceAccount)).toBe(true);
      expect(serviceAbility.can(action, userMember)).toBe(false);
      expect(serviceAbility.can(action, outside)).toBe(false);
      expect(
        serviceAbility.can(
          action === "read" ? "write" : "read",
          serviceAccount,
        ),
      ).toBe(false);
      const clientAbility = createMongoAbility(
        serializeAbilityRules(serviceAbility),
      );
      expect(
        clientAbility.can(
          action,
          subject("Member", {
            workspaceId: workspace.id,
            type: "SERVICE_ACCOUNT",
          }),
        ),
      ).toBe(true);
      expect(
        clientAbility.can(
          action,
          subject("Member", {
            workspaceId: workspace.id,
            type: "USER",
          }),
        ),
      ).toBe(false);
    },
  );
  it.each(["set-roles", "set-permissions"])(
    "requires service writes and member:%s to change service authorization",
    (action) => {
      const workspace = new Workspace();
      const serviceAccount = Object.assign(new Member(), {
        workspace,
        type: "SERVICE_ACCOUNT",
      });
      for (const permissions of [
        [`member:${action}`],
        ["service-account:write"],
        [`member:${action}`, "service-account:write"],
      ]) {
        const ability = AuthAbilityFactory.createAbility(
          {
            user: null,
            member: null,
            workspace,
            userPermissions: [],
            workspacePermissions: permissions,
          },
          withAuthTestFeatures({ workspace: { enabled: true } }),
        );
        expect(ability.can(action, serviceAccount)).toBe(
          permissions.length === 2,
        );
      }
    },
  );
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
            : buildWorkspacePermissionAbility([`member-api-key:${action}`]);
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
      "member-api-key:write",
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

describe("explicit permission catalog", () => {
  describe("explicit auth permission catalog", () => {
    it("contains 35 distinct, scoped permissions", () => {
      const permissions = [
        ...DEFAULT_USER_PERMISSIONS,
        ...DEFAULT_WORKSPACE_PERMISSIONS,
      ];
      expect(permissions).toHaveLength(35);
      expect(new Set(permissions).size).toBe(35);
    });

    it("does not add baseline abilities to empty credentials", () => {
      const abilities = [
        AuthAbilityFactory.createAbility(
          {
            workspace: null,
            member: null,
            workspacePermissions: [],
            user: new User(),
            userPermissions: [],
          },
          withAuthTestFeatures({ workspace: { enabled: true } }),
        ),
        AuthAbilityFactory.createAbility(
          {
            user: null,
            member: null,
            userPermissions: [],
            workspace: new Workspace(),
            workspacePermissions: [],
          },
          withAuthTestFeatures({ workspace: { enabled: true } }),
        ),
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
      ["member-api-key", WorkspaceApiKey],
    ] as const)(
      "keeps %s write independent from read and sensitive grants",
      (resource, subject) => {
        const ability = AuthAbilityFactory.createAbility(
          {
            user: null,
            member: null,
            userPermissions: [],
            workspace: new Workspace(),
            workspacePermissions: [`${resource}:write`],
          },
          withAuthTestFeatures({ workspace: { enabled: true } }),
        );
        expect(ability.can("write", subject)).toBe(true);
        expect(ability.can("read", subject)).toBe(false);
        expect(ability.can("set-roles", subject)).toBe(false);
        expect(ability.can("set-permissions", subject)).toBe(false);
      },
    );

    it("uses member:invite for invitation management without granting member writes", () => {
      const ability = AuthAbilityFactory.createAbility(
        {
          user: null,
          member: null,
          userPermissions: [],
          workspace: new Workspace(),
          workspacePermissions: ["member:invite"],
        },
        withAuthTestFeatures({ workspace: { enabled: true } }),
      );
      expect(ability.can("read", Invitation)).toBe(true);
      expect(ability.can("write", Invitation)).toBe(true);
      expect(ability.can("write", Member)).toBe(false);
      expect(ability.can("set-roles", Member)).toBe(false);
      expect(ability.can("set-permissions", Member)).toBe(false);
      const memberWriter = AuthAbilityFactory.createAbility(
        {
          user: null,
          member: null,
          userPermissions: [],
          workspace: new Workspace(),
          workspacePermissions: ["member:write"],
        },
        withAuthTestFeatures({ workspace: { enabled: true } }),
      );
      expect(memberWriter.can("read", Invitation)).toBe(false);
      expect(memberWriter.can("write", Invitation)).toBe(false);
    });

    it("keeps personal and workspace key permissions separate", () => {
      const userAbility = AuthAbilityFactory.createAbility(
        {
          workspace: null,
          member: null,
          workspacePermissions: [],
          user: new User(),
          userPermissions: ["user-api-key:write", "member-api-key:read"],
        },
        withAuthTestFeatures({ workspace: { enabled: true } }),
      );
      const workspaceAbility = AuthAbilityFactory.createAbility(
        {
          user: null,
          member: null,
          userPermissions: [],
          workspace: new Workspace(),
          workspacePermissions: ["user-api-key:write", "member-api-key:read"],
        },
        withAuthTestFeatures({ workspace: { enabled: true } }),
      );
      expect(userAbility.can("write", UserApiKey)).toBe(true);
      expect(userAbility.can("read", UserApiKey)).toBe(false);
      expect(workspaceAbility.can("write", WorkspaceApiKey)).toBe(false);
      expect(workspaceAbility.can("read", WorkspaceApiKey)).toBe(true);
    });

    it("retains object restrictions for invitation management", () => {
      const workspace = new Workspace();
      const ability = AuthAbilityFactory.createAbility(
        {
          user: null,
          member: null,
          userPermissions: [],
          workspace,
          workspacePermissions: ["member:invite"],
        },
        withAuthTestFeatures({
          workspace: { enabled: true },
          buildAbility({ cannot }) {
            cannot("write", Invitation, { status: "accepted" });
          },
        }),
      );
      expect(
        ability.can(
          "write",
          Object.assign(new Invitation(), { status: "pending", workspace }),
        ),
      ).toBe(true);
      expect(
        ability.can(
          "write",
          Object.assign(new Invitation(), { status: "accepted", workspace }),
        ),
      ).toBe(false);
      expect(
        ability.can(
          "read",
          Object.assign(new Invitation(), { status: "accepted", workspace }),
        ),
      ).toBe(true);
      expect(ability.can("write", "Invitation")).toBe(true);
    });

    it("grants workspace creation explicitly through the user catalog", () => {
      const ability = AuthAbilityFactory.createAbility(
        {
          workspace: null,
          member: null,
          workspacePermissions: [],
          user: new User(),
          userPermissions: ["workspace:create"],
        },
        withAuthTestFeatures({ workspace: { enabled: true } }),
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
});

describe("optional workspace behavior", () => {
  it.each([undefined, {}, { enabled: false }])(
    "keeps workspace catalogs and grants disabled for %j",
    (workspace) => {
      const options: AuthModuleOptions = { workspace };
      expect(resolveAuthCatalog(options, "workspace")).toEqual({
        permissions: [],
        roles: {},
      });
      expect(resolveAuthCatalog(options, "user").permissions).not.toContain(
        "workspace:create",
      );
      expect(resolveAuthCatalog(options, "user").roles.user).toEqual([]);
      expect(
        resolveApiKeyPermissionCatalog(options, "member").permissions,
      ).toEqual([]);
      expect(
        resolveApiKeyPermissionCatalog(options, "user").permissions,
      ).not.toContain("workspace:update");
      const ability = AuthAbilityFactory.createAbility(
        {
          user: new User(),
          workspace: new Workspace(),
          member: new Member(),
          userPermissions: ["user:read", "workspace:create"],
          workspacePermissions: ["workspace:delete"],
        },
        withAuthTestFeatures(options),
      );
      expect(ability.can("read", User)).toBe(true);
      expect(ability.can("create", Workspace)).toBe(false);
      expect(ability.can("delete", Workspace)).toBe(false);
    },
  );
});
