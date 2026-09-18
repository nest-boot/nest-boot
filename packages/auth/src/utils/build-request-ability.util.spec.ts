import { createMongoAbility, subject } from "@casl/ability";
import { RequestContext } from "@nest-boot/request-context";

import { Member } from "../entities/member.entity.js";
import { User } from "../entities/user.entity.js";
import { UserApiKey } from "../entities/user-api-key.entity.js";
import { Workspace } from "../entities/workspace.entity.js";
import { WorkspaceApiKey } from "../entities/workspace-api-key.entity.js";
import { RequestIdentity } from "../infrastructure/request-identity.js";
import type { AbilityRules } from "../interfaces/ability-rules.interface.js";
import {
  buildRequestUserAbility,
  buildRequestWorkspaceAbility,
} from "./build-request-ability.util.js";
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
    const ability = buildRequestUserAbility({
      user: {
        permissions: ["article:update"],
        buildAbility: (rules) => {
          saved = rules;
          rules.cannot("update", "Article", "secret");
          rules.can("article:update", "update", "Article", fields, conditions);
          rules.cannot("delete", "User");
        },
      },
    });
    if (!ability) throw new Error("Expected user ability");
    expect(ability.can("read", new User())).toBe(true);
    expect(ability.can("delete", new User())).toBe(false);
    fields.push("private");
    conditions.authorId = "other";
    expect(() => saved?.can("article:update", "delete", "Article")).toThrow(
      "synchronously",
    );
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
      buildRequestUserAbility({
        user: {
          buildAbility: (rules) => {
            rules.can("unknown:read", "read", "Article");
          },
        },
      }),
    ).toThrow("Unknown ability permission: unknown:read");
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
    RequestIdentity.stage({
      apiKey: Object.assign(new UserApiKey(), {
        permissions: ["user:get", "workspace:update"],
      }),
    });
    expect(buildRequestUserAbility({})?.can("read", User)).toBe(true);
    expect(buildRequestUserAbility({})?.can("delete", User)).toBe(false);
    expect(buildRequestWorkspaceAbility({})?.can("update", Workspace)).toBe(
      true,
    );
    expect(buildRequestWorkspaceAbility({})?.can("delete", Workspace)).toBe(
      false,
    );
  });

  it("binds custom conditional grants to effective permissions and retains restrictions", () => {
    RequestContext.set(
      User,
      Object.assign(new User(), { roles: [], permissions: ["article:read"] }),
    );
    const options = {
      user: {
        permissions: ["article:read"],
        buildAbility: (rules: AbilityRules) => {
          rules.can("article:read", "read", "Article", { authorId: "me" });
          rules.cannot("read", "Article", { hidden: true });
        },
      },
    };
    const ability = buildRequestUserAbility(options);
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
    expect(buildRequestUserAbility(options)?.can("read", "Article")).toBe(
      false,
    );
  });

  it.each([User, "User", WorkspaceApiKey, "all", ["Article", User]])(
    "rejects custom grants on reserved subjects: %s",
    (target) => {
      RequestContext.set(User, new User());
      expect(() =>
        buildRequestUserAbility({
          user: {
            permissions: ["article:read"],
            buildAbility: (rules) => {
              rules.can("article:read", "manage", target);
            },
          },
        }),
      ).toThrow("built-in auth");
    },
  );

  it("allows restrictions but does not expose the builder or accept a replacement ability", () => {
    RequestContext.set(User, Object.assign(new User(), { roles: ["admin"] }));
    const ability = buildRequestUserAbility({
      user: {
        buildAbility: (rules) => {
          expect(rules).not.toHaveProperty("build");
          expect(rules).not.toHaveProperty("rules");
          rules.cannot("delete", User);
        },
      },
    });
    expect(ability?.can("read", User)).toBe(true);
    expect(ability?.can("delete", User)).toBe(false);
    expect(() =>
      buildRequestUserAbility({
        user: { buildAbility: (() => ({ can: () => true })) as never },
      }),
    ).toThrow("must not return");
  });
});
