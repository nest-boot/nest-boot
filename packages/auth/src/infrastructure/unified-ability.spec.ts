import { createMongoAbility, subject } from "@casl/ability";
import { ref } from "@mikro-orm/core";
import { RequestContext } from "@nest-boot/request-context";
import { assert } from "vitest";

import { AuthAbility } from "../abilities/auth.ability.js";
import type { AuthModuleOptions } from "../auth-module-options.interface.js";
import {
  Invitation,
  Member,
  User,
  UserApiKey,
  Workspace,
  WorkspaceApiKey,
} from "../entities/index.js";
import { buildRequestAbility } from "../utils/build-request-ability.util.js";
import { serializeAbilityRules } from "../utils/serialize-ability-rules.util.js";
import { RequestIdentity } from "./request-identity.js";

function identity() {
  const user = Object.assign(new User(), { roles: ["admin"] });
  const workspace = new Workspace();
  const member = Object.assign(new Member(), {
    roles: ["owner"],
    user: ref(User, user),
    workspace: ref(Workspace, workspace),
  });
  return { user, workspace, member };
}

describe("unified request ability", () => {
  it("applies shared restrictions after grants from either permission source", async () => {
    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      const current = identity();
      current.user.permissions = ["report:read"];
      current.member.permissions = ["report:read"];
      RequestIdentity.stage(current);
      const ability = buildRequestAbility({
        user: { permissions: ["report:read"] },
        workspace: { permissions: ["report:read"] },
        buildAbility: ({ can, cannot }) => {
          can({ user: "report:read" }, "read", "Report");
          cannot("read", "Report", { private: true });
          cannot("update", "User");
          can({ workspace: "report:read" }, "read", "Report");
        },
      });
      expect(ability.can("read", subject("Report", { private: false }))).toBe(
        true,
      );
      expect(ability.can("read", subject("Report", { private: true }))).toBe(
        false,
      );
      expect(ability.can("update", current.user)).toBe(false);
    });
  });

  it("replaces workspace conditions instead of accumulating grants on a switch", async () => {
    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      const first = identity();
      RequestIdentity.stage(first);
      RequestIdentity.prepare({});
      const second = identity();
      second.member.user = ref(User, first.user);
      const em = {
        getSessionContext: vi.fn(() => ({})),
        setSessionContext: vi.fn(),
      };
      RequestIdentity.update(
        em as never,
        {},
        { workspace: second.workspace, member: second.member },
      );
      const ability = RequestContext.get(AuthAbility);
      assert(ability);
      expect(ability.can("write", first.member)).toBe(false);
      expect(ability.can("write", second.member)).toBe(true);
      expect(ability.can("read", User)).toBe(true);
      expect(em.setSessionContext).toHaveBeenCalledWith({
        role: "authenticated",
        variables: {
          "app.user.id": first.user.id,
          "app.workspace.id": second.workspace.id,
        },
      });
    });
  });

  it("builds user and workspace rules once with the complete identity context", async () => {
    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      const current = identity();
      const configure = vi.fn();
      RequestIdentity.stage(current);
      RequestIdentity.prepare({ buildAbility: configure });
      RequestIdentity.prepare({ buildAbility: configure });
      const ability = RequestContext.get(AuthAbility);
      assert(ability);
      expect(configure).toHaveBeenCalledOnce();
      expect(configure.mock.calls[0][1]).toMatchObject(current);
      expect(configure.mock.calls[0][1].userPermissions).toContain("user:read");
      expect(configure.mock.calls[0][1].workspacePermissions).toContain(
        "member:write",
      );
      expect(ability.can("read", User)).toBe(true);
      expect(ability.can("create", Workspace)).toBe(true);
      expect(ability.can("write", current.member)).toBe(true);
    });
  });

  it("keeps workspace conditions on entities and serialized client subjects", async () => {
    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      const current = identity();
      RequestIdentity.stage(current);
      const ability = buildRequestAbility({});
      const restored = createMongoAbility(serializeAbilityRules(ability));
      for (const Entity of [Member, Invitation, WorkspaceApiKey]) {
        const own = Object.assign(new Entity(), {
          workspace: ref(Workspace, current.workspace),
        });
        const other = Object.assign(new Entity(), {
          workspace: ref(Workspace, new Workspace()),
        });
        expect(ability.can("write", Entity)).toBe(true);
        expect(ability.can("write", own)).toBe(true);
        expect(ability.can("write", other)).toBe(false);
        expect(
          restored.can(
            "write",
            subject(Entity.name, { workspaceId: own.workspaceId }),
          ),
        ).toBe(true);
        expect(
          restored.can(
            "write",
            subject(Entity.name, { workspaceId: other.workspaceId }),
          ),
        ).toBe(false);
      }
      expect(ability.can("update", current.workspace)).toBe(true);
      expect(ability.can("update", new Workspace())).toBe(false);
    });
  });

  it.each(["missing", "disabled", "other-workspace", "other-user"])(
    "omits workspace grants for a %s membership",
    async (state) => {
      await RequestContext.run(new RequestContext({ type: "test" }), () => {
        const current = identity();
        if (state === "disabled") current.member.status = "DISABLED";
        if (state === "other-workspace")
          current.member.workspace = ref(Workspace, new Workspace());
        if (state === "other-user") current.member.user = ref(User, new User());
        RequestIdentity.stage({
          ...current,
          member: state === "missing" ? null : current.member,
        });
        const configure = vi.fn();
        const ability = buildRequestAbility({ buildAbility: configure });
        expect(ability.can("read", User)).toBe(true);
        expect(ability.can("write", Member)).toBe(false);
        expect(configure.mock.calls[0][1]).toMatchObject({
          workspace: null,
          member: null,
          workspacePermissions: [],
        });
      });
    },
  );

  it.each(["user", "workspace"] as const)(
    "keeps same-name business permission bindings in their %s source",
    async (scope) => {
      await RequestContext.run(new RequestContext({ type: "test" }), () => {
        const current = identity();
        current.user.roles = [];
        current.member.roles = [];
        current[scope === "user" ? "user" : "member"].permissions = [
          "report:read",
        ];
        RequestIdentity.stage(current);
        const ability = buildRequestAbility({
          user: { permissions: ["report:read"] },
          workspace: { permissions: ["report:read"] },
          buildAbility: ({ can }) => {
            can({ user: "report:read" }, "read", "PersonalReport");
            can({ workspace: "report:read" }, "read", "WorkspaceReport");
          },
        });
        expect(ability.can("read", "PersonalReport")).toBe(scope === "user");
        expect(ability.can("read", "WorkspaceReport")).toBe(
          scope === "workspace",
        );
      });
    },
  );

  it.each([UserApiKey, WorkspaceApiKey])(
    "bounds combined rules by %s credentials",
    async (Entity) => {
      await RequestContext.run(new RequestContext({ type: "test" }), () => {
        const current = identity();
        const apiKey = Object.assign(new Entity(), {
          permissions: ["member:read"],
          user: ref(User, current.user),
          workspace: ref(Workspace, current.workspace),
        });
        RequestIdentity.stage({ ...current, apiKey });
        const configure = vi.fn();
        const ability = buildRequestAbility({ buildAbility: configure });
        expect(ability.can("read", User)).toBe(false);
        expect(ability.can("read", current.member)).toBe(true);
        expect(ability.can("write", current.member)).toBe(false);
        if (Entity === WorkspaceApiKey)
          expect(configure.mock.calls[0][1]).toMatchObject({
            user: null,
            member: null,
            userPermissions: [],
          });
      });
    },
  );

  it("rebuilds after workspace exit, retaining user grants but removing workspace business rules", async () => {
    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      const current = identity();
      current.member.permissions = ["report:read"];
      const options: AuthModuleOptions = {
        workspace: { permissions: ["report:read"] },
        buildAbility: ({ can }, { workspace }) => {
          if (workspace)
            can({ workspace: "report:read" }, "read", "Report", {
              workspaceId: workspace.id,
            });
        },
      };
      RequestIdentity.stage(current);
      RequestIdentity.prepare(options);
      expect(RequestContext.get(AuthAbility)?.can("read", "Report")).toBe(true);
      const em = { getSessionContext: vi.fn(), setSessionContext: vi.fn() };
      RequestIdentity.clearWorkspace(em as never, options);
      const ability = RequestContext.get(AuthAbility);
      assert(ability);
      expect(ability.can("read", User)).toBe(true);
      expect(ability.can("read", "Report")).toBe(false);
      expect(ability.can("write", Member)).toBe(false);
    });
  });
});
