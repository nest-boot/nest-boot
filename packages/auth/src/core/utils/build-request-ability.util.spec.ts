import { createMongoAbility, subject } from "@casl/ability";
import { RequestContext } from "@nest-boot/request-context";
import { assert } from "vitest";

import { stageIdentity } from "../../../test/fixtures/auth-context.fixture.js";
import { withAuthTestFeatures } from "../../../test/fixtures/enabled-auth-features.fixture.js";
import { ApiKey } from "../../api-key/entities/api-key.entity.js";
import { SystemAccount } from "../../api-key/entities/system-account.entity.js";
import { SystemApiKey } from "../../api-key/objects/system-api-key.object.js";
import { UserApiKey } from "../../api-key/objects/user-api-key.object.js";
import { WorkspaceApiKey } from "../../api-key/objects/workspace-api-key.object.js";
import type { AbilityRules } from "../../common/interfaces/ability-rules.interface.js";
import { serializeAbilityRules } from "../../common/utils/serialize-ability-rules.util.js";
import { Workspace } from "../../workspace/entities/workspace.entity.js";
import { WorkspaceMember } from "../../workspace/entities/workspace-member.entity.js";
import { SELECTED_WORKSPACE } from "../constants/auth.constants.js";
import { User } from "../entities/user.entity.js";
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
      const configure = vi.fn(({ can }: AbilityRules, context) => {
        expect(context.user).toBeNull();
        expect(context.member).toBeNull();
        expect(context.workspace).toBe(enabled ? workspace : null);
        expect(context.workspacePermissions).toEqual([]);
        if (context.workspace) {
          can({ user: "workspace:update-any" }, "write", "Report", {
            workspaceId: context.workspace.id,
          });
        }
      });
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
    let saved: AbilityRules | undefined;
    const ability = buildRequestAbility(
      withAuthTestFeatures({
        workspace: { enabled: true },
        buildAbility: (rules) => {
          saved = rules;
          rules.cannot("update", "Article", "secret");
          rules.can(
            { user: "article:update" },
            "update",
            "Article",
            fields,
            conditions,
          );
          rules.cannot("delete", "User");
        },

        user: {
          permissions: ["article:update"],
        },
      }),
    );
    if (!ability) {
      throw new Error("Expected user ability");
    }
    expect(ability.can("read", new User())).toBe(true);
    expect(ability.can("delete", new User())).toBe(false);
    fields.push("private");
    conditions.authorId = "other";
    expect(() =>
      saved?.can({ user: "article:update" }, "delete", "Article"),
    ).toThrow("synchronously");
    const restored = createMongoAbility(serializeAbilityRules(ability));
    for (const candidate of [ability, restored]) {
      const article = subject("Article", { authorId: "me" });
      expect(candidate.can("update", article, "title")).toBe(true);
      expect(candidate.can("update", article, "secret")).toBe(false);
      expect(candidate.can("update", article, "private")).toBe(false);
    }
  });

  it("rejects unknown permission bindings even if the principal lacks the grant", () => {
    RequestContext.set(User, new User());
    expect(() =>
      buildRequestAbility(
        withAuthTestFeatures({
          workspace: { enabled: true },
          buildAbility: (rules) => {
            rules.can({ user: "unknown:read" }, "read", "Article");
          },

          user: {},
        }),
      ),
    ).toThrow("Unknown user ability permission: unknown:read");
  });

  beforeEach(() => {
    vi.spyOn(RequestContext, "current").mockReturnValue(
      new RequestContext({ type: "test" }),
    );
    vi.spyOn(RequestContext, "isActive").mockReturnValue(true);
  });
  afterEach(() => vi.restoreAllMocks());

  it("builds built-in abilities without callbacks, using API-key intersections", () => {
    RequestContext.set(User, Object.assign(new User(), { roles: ["admin"] }));
    RequestContext.set(
      WorkspaceMember,
      Object.assign(new WorkspaceMember(), { roles: ["owner"] }),
    );
    RequestContext.set(SELECTED_WORKSPACE, new Workspace());
    Object.assign(requireWorkspaceMember(), {
      user: RequestContext.get(User),
      workspace: RequestContext.get<Workspace | null>(SELECTED_WORKSPACE),
    });
    stageIdentity({
      apiKey: Object.assign(new UserApiKey(new ApiKey()), {
        permissions: ["user:read", "workspace:update"],
      }),
    });
    expect(
      buildRequestAbility(
        withAuthTestFeatures({ workspace: { enabled: true } }),
      )?.can("read", User),
    ).toBe(true);
    expect(
      buildRequestAbility(
        withAuthTestFeatures({ workspace: { enabled: true } }),
      )?.can("delete", User),
    ).toBe(false);
    expect(
      buildRequestAbility(
        withAuthTestFeatures({ workspace: { enabled: true } }),
      )?.can("update", Workspace),
    ).toBe(true);
    expect(
      buildRequestAbility(
        withAuthTestFeatures({ workspace: { enabled: true } }),
      )?.can("delete", Workspace),
    ).toBe(false);
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
      expect(ability?.can("read", Workspace)).toBe(true);
      expect(ability?.can("update", Workspace)).toBe(true);
      expect(ability?.can("delete", Workspace)).toBe(false);
      expect(ability?.can("read", WorkspaceMember)).toBe(false);
      expect(ability?.can("read", User)).toBe(false);
      member.permissions = [];
      stageIdentity({ member });
      expect(
        buildRequestAbility(
          withAuthTestFeatures({ workspace: { enabled: true } }),
        )?.can("update", Workspace),
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
      buildAbility: (rules: AbilityRules) => {
        rules.can({ user: "article:read" }, "read", "Article", {
          authorId: "me",
        });
        rules.cannot("read", "Article", { hidden: true });
      },

      user: {
        permissions: ["article:read"],
      },
    };
    const ability = buildRequestAbility(withAuthTestFeatures(options));
    if (!ability) {
      throw new Error("Expected a user ability");
    }
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
      buildRequestAbility(withAuthTestFeatures(options))?.can(
        "read",
        "Article",
      ),
    ).toBe(true);
  });

  it.each([User, "User", WorkspaceApiKey, "all", ["Article", User]])(
    "rejects custom grants on reserved subjects: %s",
    (target) => {
      RequestContext.set(User, new User());
      expect(() =>
        buildRequestAbility(
          withAuthTestFeatures({
            workspace: { enabled: true },
            buildAbility: (rules) => {
              rules.can({ user: "article:read" }, "manage", target);
            },

            user: {
              permissions: ["article:read"],
            },
          }),
        ),
      ).toThrow("built-in auth");
    },
  );

  it("allows restrictions but does not expose the builder or accept a replacement ability", () => {
    RequestContext.set(User, Object.assign(new User(), { roles: ["admin"] }));
    const ability = buildRequestAbility(
      withAuthTestFeatures({
        workspace: { enabled: true },
        buildAbility: (rules) => {
          expect(rules).not.toHaveProperty("build");
          expect(rules).not.toHaveProperty("rules");
          rules.cannot("delete", User);
        },

        user: {},
      }),
    );
    expect(ability?.can("read", User)).toBe(true);
    expect(ability?.can("delete", User)).toBe(false);
    expect(() =>
      buildRequestAbility(
        withAuthTestFeatures({
          workspace: { enabled: true },
          buildAbility: () => ({ can: () => true }),

          user: {},
        }),
      ),
    ).toThrow("must not return");
  });
});
/**
 * Returns member stored in the current test context.
 * @returns WorkspaceMember stored in the current test context.
 */
function requireWorkspaceMember(): WorkspaceMember {
  const member = RequestContext.get(WorkspaceMember);
  assert(member);
  return member;
}
