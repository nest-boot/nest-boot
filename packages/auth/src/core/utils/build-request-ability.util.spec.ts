import { createMongoAbility, subject } from "@casl/ability";
import { RequestContext } from "@nest-boot/request-context";
import { assert } from "vitest";

import { withAuthTestFeatures } from "../../../test/fixtures/enabled-auth-features.fixture.js";
import { UserApiKey } from "../../api-key/entities/user-api-key.entity.js";
import { WorkspaceApiKey } from "../../api-key/entities/workspace-api-key.entity.js";
import type { AbilityRules } from "../../common/interfaces/ability-rules.interface.js";
import { serializeAbilityRules } from "../../common/utils/serialize-ability-rules.util.js";
import { Member } from "../../workspace/entities/member.entity.js";
import { Workspace } from "../../workspace/entities/workspace.entity.js";
import { User } from "../entities/user.entity.js";
import { RequestIdentity } from "../infrastructure/request-identity.js";
import { buildRequestAbility } from "./build-request-ability.util.js";

describe("framework-owned request abilities", () => {
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
      Member,
      Object.assign(new Member(), { roles: ["owner"] }),
    );
    RequestContext.set(Workspace, new Workspace());
    Object.assign(requireMember(), {
      user: RequestContext.get(User),
      workspace: RequestContext.get(Workspace),
    });
    RequestIdentity.stage({
      apiKey: Object.assign(new UserApiKey(), {
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
      const member = Object.assign(new Member(), {
        type,
        user,
        workspace,
        roles: ["member"],
        permissions: ["workspace:update"],
      });
      const apiKey = Object.assign(new WorkspaceApiKey(), {
        member,
        permissions: ["workspace:read", "workspace:update", "workspace:delete"],
      });
      RequestIdentity.stage({ user, member, workspace, apiKey });
      const ability = buildRequestAbility(
        withAuthTestFeatures({ workspace: { enabled: true } }),
      );
      expect(ability?.can("read", Workspace)).toBe(true);
      expect(ability?.can("update", Workspace)).toBe(true);
      expect(ability?.can("delete", Workspace)).toBe(false);
      expect(ability?.can("read", Member)).toBe(false);
      expect(ability?.can("read", User)).toBe(false);
      member.permissions = [];
      RequestIdentity.stage({ member });
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
    RequestIdentity.stage({
      apiKey: Object.assign(new UserApiKey(), { permissions: [] }),
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
 * @returns Member stored in the current test context.
 */
function requireMember(): Member {
  const member = RequestContext.get(Member);
  assert(member);
  return member;
}
