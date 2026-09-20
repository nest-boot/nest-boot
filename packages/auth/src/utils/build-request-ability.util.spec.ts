import { createMongoAbility, subject } from "@casl/ability";
import { RequestContext } from "@nest-boot/request-context";
import { assert } from "vitest";

import { Member } from "../entities/member.entity.js";
import { User } from "../entities/user.entity.js";
import { UserApiKey } from "../entities/user-api-key.entity.js";
import { Workspace } from "../entities/workspace.entity.js";
import { WorkspaceApiKey } from "../entities/workspace-api-key.entity.js";
import { RequestIdentity } from "../infrastructure/request-identity.js";
import type { AbilityRules } from "../interfaces/ability-rules.interface.js";
import { buildRequestAbility } from "./build-request-ability.util.js";
import { serializeAbilityRules } from "./serialize-ability-rules.util.js";

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
    const ability = buildRequestAbility({
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
    });
    if (!ability) throw new Error("Expected user ability");
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
      buildRequestAbility({
        buildAbility: (rules) => {
          rules.can({ user: "unknown:read" }, "read", "Article");
        },

        user: {},
      }),
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
    expect(buildRequestAbility({})?.can("read", User)).toBe(true);
    expect(buildRequestAbility({})?.can("delete", User)).toBe(false);
    expect(buildRequestAbility({})?.can("update", Workspace)).toBe(true);
    expect(buildRequestAbility({})?.can("delete", Workspace)).toBe(false);
  });

  it("binds custom conditional grants to effective permissions and retains restrictions", () => {
    RequestContext.set(
      User,
      Object.assign(new User(), { roles: [], permissions: ["article:read"] }),
    );
    const options = {
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
    const ability = buildRequestAbility(options);
    if (!ability) throw new Error("Expected a user ability");
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
    expect(buildRequestAbility(options)?.can("read", "Article")).toBe(false);
  });

  it.each([User, "User", WorkspaceApiKey, "all", ["Article", User]])(
    "rejects custom grants on reserved subjects: %s",
    (target) => {
      RequestContext.set(User, new User());
      expect(() =>
        buildRequestAbility({
          buildAbility: (rules) => {
            rules.can({ user: "article:read" }, "manage", target);
          },

          user: {
            permissions: ["article:read"],
          },
        }),
      ).toThrow("built-in auth");
    },
  );

  it("allows restrictions but does not expose the builder or accept a replacement ability", () => {
    RequestContext.set(User, Object.assign(new User(), { roles: ["admin"] }));
    const ability = buildRequestAbility({
      buildAbility: (rules) => {
        expect(rules).not.toHaveProperty("build");
        expect(rules).not.toHaveProperty("rules");
        rules.cannot("delete", User);
      },

      user: {},
    });
    expect(ability?.can("read", User)).toBe(true);
    expect(ability?.can("delete", User)).toBe(false);
    expect(() =>
      buildRequestAbility({
        buildAbility: (() => ({ can: () => true })) as never,

        user: {},
      }),
    ).toThrow("must not return");
  });
});
function requireMember(): Member {
  const member = RequestContext.get(Member);
  assert(member);
  return member;
}
