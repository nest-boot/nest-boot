import { createMongoAbility, subject } from "@casl/ability";
import { RequestContext } from "@nest-boot/request-context";

import { stageIdentity } from "../../../test/fixtures/auth-context.fixture.js";
import { withAuthTestFeatures } from "../../../test/fixtures/enabled-auth-features.fixture.js";
import { ApiKey } from "../../api-key/entities/api-key.entity.js";
import { SystemAccount } from "../../api-key/entities/system-account.entity.js";
import { SystemApiKey } from "../../api-key/objects/system-api-key.object.js";
import { UserApiKey } from "../../api-key/objects/user-api-key.object.js";
import { WorkspaceApiKey } from "../../api-key/objects/workspace-api-key.object.js";
import { serializeAbilityRules } from "../../common/utils/serialize-ability-rules.util.js";
import { Workspace } from "../../workspace/entities/workspace.entity.js";
import { WorkspaceMember } from "../../workspace/entities/workspace-member.entity.js";
import { User } from "../entities/user.entity.js";
import type { BuildAbilityContext } from "../interfaces/build-ability-context.interface.js";
import { buildRequestAbility } from "./build-request-ability.util.js";

describe("framework-owned request abilities", () => {
  it.each([true, false])(
    "exposes the system credential's workspace to business rules only when enabled (%s)",
    (enabled) => {
      const workspace = new Workspace();
      const account = Object.assign(new SystemAccount(), {
        permissions: ["workspace:update-any"],
      });
      const apiKey = Object.assign(new SystemApiKey(new ApiKey()), {
        owner: { id: account.id, unwrap: () => account },
        permissions: ["workspace:update-any"],
      });
      stageIdentity({ apiKey, user: null, member: null, workspace });
      const configure = vi.fn(
        ({ builder: { can }, ...context }: BuildAbilityContext) => {
          const { permissions } = context;
          expect(context.user).toBeNull();
          expect(context.member).toBeNull();
          expect(context.workspace).toBe(enabled ? workspace : null);
          expect(context.workspacePermissions).toEqual([]);
          if (
            context.workspace &&
            permissions.includes("workspace:update-any")
          ) {
            can("write", "Report", {
              workspaceId: context.workspace.id,
            });
          }
        },
      );
      const ability = buildRequestAbility(
        withAuthTestFeatures({
          workspace: { enabled },
          buildAbility: configure,
        }),
      );
      expect(configure).toHaveBeenCalledOnce();
      expect(
        ability.can("write", subject("Report", { workspaceId: workspace.id })),
      ).toBe(enabled);
      expect(
        ability.can("write", subject("Report", { workspaceId: "another" })),
      ).toBe(false);
      expect(ability.can("write", WorkspaceMember)).toBe(false);
    },
  );
  it("keeps field restrictions and class/string subjects consistent after serialization", () => {
    RequestContext.set(
      User,
      Object.assign(new User(), {
        roles: ["admin"],
        permissions: ["article:update"],
      }),
    );
    const conditions = { authorId: "me" };
    const fields = ["title", "secret"];
    const ability = buildRequestAbility(
      withAuthTestFeatures({
        workspace: { enabled: true },
        buildAbility: ({ builder: rules }) => {
          rules.can("update", "Article", fields, conditions);
          rules.cannot("update", "Article", "secret");
          rules.cannot("delete", "User");
        },

        user: {
          permissions: ["article:update"],
        },
      }),
    );
    expect(ability.can("read", new User())).toBe(true);
    expect(ability.can("delete", new User())).toBe(false);
    const restored = createMongoAbility(serializeAbilityRules(ability));
    for (const candidate of [ability, restored]) {
      const article = subject("Article", { authorId: "me" });
      expect(candidate.can("update", article, "title")).toBe(true);
      expect(candidate.can("update", article, "secret")).toBe(false);
      expect(candidate.can("update", article, "private")).toBe(false);
    }
  });

  it("lets trusted application code declare unconditional native CASL grants", () => {
    RequestContext.set(User, new User());
    const ability = buildRequestAbility({
      buildAbility: ({ builder: { can } }) =>
        can("manage", "all").because("Application policy"),
    });
    expect(ability.can("delete", User)).toBe(true);
    expect(ability.can("archive", "Article")).toBe(true);
  });

  beforeEach(() => {
    vi.spyOn(RequestContext, "current").mockReturnValue(
      new RequestContext({ type: "test" }),
    );
    vi.spyOn(RequestContext, "isActive").mockReturnValue(true);
  });
  afterEach(() => vi.restoreAllMocks());

  it("builds built-in abilities without callbacks, using API-key intersections", () => {
    const user = Object.assign(new User(), { roles: ["admin"] });
    const workspace = new Workspace();
    const member = Object.assign(new WorkspaceMember(), {
      user,
      workspace,
      roles: ["owner"],
    });
    stageIdentity({
      user,
      workspace,
      member,
      apiKey: Object.assign(new UserApiKey(new ApiKey()), {
        permissions: ["user:read", "workspace:update"],
      }),
    });
    const ability = buildRequestAbility(
      withAuthTestFeatures({ workspace: { enabled: true } }),
    );
    expect(ability.can("read", User)).toBe(true);
    expect(ability.can("delete", User)).toBe(false);
    expect(ability.can("update", Workspace)).toBe(true);
    expect(ability.can("delete", Workspace)).toBe(false);
  });

  it.each(["USER", "SERVICE_ACCOUNT"] as const)(
    "intersects oversized member keys with the current %s owner's role and direct grants",
    (type) => {
      const workspace = new Workspace();
      const user =
        type === "USER"
          ? Object.assign(new User(), { roles: ["admin"] })
          : null;
      const member = Object.assign(new WorkspaceMember(), {
        type,
        user,
        workspace,
        roles: ["member"],
        permissions: ["workspace:update"],
      });
      const apiKey = Object.assign(new WorkspaceApiKey(new ApiKey()), {
        member,
        permissions: ["workspace:read", "workspace:update", "workspace:delete"],
      });
      stageIdentity({ user, member, workspace, apiKey });
      const ability = buildRequestAbility(
        withAuthTestFeatures({ workspace: { enabled: true } }),
      );
      expect(ability.can("read", Workspace)).toBe(true);
      expect(ability.can("update", Workspace)).toBe(true);
      expect(ability.can("delete", Workspace)).toBe(false);
      expect(ability.can("read", WorkspaceMember)).toBe(false);
      expect(ability.can("read", User)).toBe(false);
      member.permissions = [];
      stageIdentity({ member });
      expect(
        buildRequestAbility(
          withAuthTestFeatures({ workspace: { enabled: true } }),
        ).can("update", Workspace),
      ).toBe(false);
    },
  );

  it("binds custom conditional grants to effective permissions and retains restrictions", () => {
    RequestContext.set(
      User,
      Object.assign(new User(), { roles: [], permissions: ["article:read"] }),
    );
    const options = {
      workspace: { enabled: true },
      buildAbility: ({ builder: rules, permissions }: BuildAbilityContext) => {
        if (permissions.includes("article:read")) {
          rules.can("read", "Article", { authorId: "me" });
        }
        rules.cannot("read", "Article", { hidden: true });
      },

      user: {
        permissions: ["article:read"],
      },
    };
    const ability = buildRequestAbility(withAuthTestFeatures(options));
    expect(ability.can("read", subject("Article", { authorId: "me" }))).toBe(
      true,
    );
    expect(ability.can("read", subject("Article", { authorId: "other" }))).toBe(
      false,
    );
    expect(
      ability.can("read", subject("Article", { authorId: "me", hidden: true })),
    ).toBe(false);
    stageIdentity({
      apiKey: Object.assign(new UserApiKey(new ApiKey()), { permissions: [] }),
    });
    expect(
      buildRequestAbility(withAuthTestFeatures(options)).can("read", "Article"),
    ).toBe(true);
  });

  it("exposes the native builder and ignores callback return values", () => {
    RequestContext.set(User, Object.assign(new User(), { roles: ["admin"] }));
    const ability = buildRequestAbility(
      withAuthTestFeatures({
        buildAbility: ({ builder }) => {
          expect(builder.build).toBeTypeOf("function");
          expect(builder.rules).toBeInstanceOf(Array);
          builder.cannot("delete", User).because("Retain accounts");
          return createMongoAbility();
        },
      }),
    );
    expect(ability.can("read", User)).toBe(true);
    expect(ability.can("delete", User)).toBe(false);
  });

  it.each([UserApiKey, WorkspaceApiKey, SystemApiKey])(
    "provides credential-limited unified permissions for %s",
    (KeyType) => {
      const readPermission =
        KeyType === SystemApiKey ? "workspace:read-any" : "article:read";
      const user = Object.assign(new User(), {
        roles: [],
        permissions: ["article:read", "article:delete"],
      });
      const workspace = new Workspace();
      const member = Object.assign(new WorkspaceMember(), {
        user,
        workspace,
        roles: [],
        permissions: ["article:read", "article:archive"],
      });
      const account = Object.assign(new SystemAccount(), {
        enabled: true,
        permissions: [readPermission, "user:delete"],
      });
      const key = Object.assign(new KeyType(new ApiKey()), {
        permissions: [readPermission, "user:update"],
        user,
        member,
        ...(KeyType === SystemApiKey
          ? { owner: { id: account.id, unwrap: () => account } }
          : {}),
      });
      stageIdentity({ user, workspace, member, apiKey: key });
      const configure = vi.fn(({ builder: { can }, permissions }) => {
        expect(Object.isFrozen(permissions)).toBe(true);
        if (permissions.includes(readPermission)) {
          can("read", "Article");
        }
        if (permissions.includes("article:archive")) {
          can("archive", "Article");
        }
      });
      const ability = buildRequestAbility(
        withAuthTestFeatures({
          user: {
            permissions: [
              "article:read",
              "article:delete",
              "article:unassigned",
            ],
          },
          workspace: {
            enabled: true,
            permissions: ["article:read", "article:archive"],
          },
          buildAbility: configure,
        }),
      );
      expect(configure).toHaveBeenCalledOnce();
      expect(configure.mock.calls[0][0].permissions).toEqual([readPermission]);
      expect(ability.can("read", "Article")).toBe(true);
      expect(ability.can("archive", "Article")).toBe(false);
      expect(ability.can("delete", "Article")).toBe(false);
    },
  );
});
