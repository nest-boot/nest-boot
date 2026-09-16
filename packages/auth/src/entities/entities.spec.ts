import { Collection, MetadataStorage } from "@mikro-orm/core";

import { Account as BaseAccount } from "./account.entity.js";
import { ApiKey as BaseApiKey } from "./api-key.entity.js";
import { Invitation as BaseInvitation } from "./invitation.entity.js";
import { Member as BaseMember } from "./member.entity.js";
import { Session as BaseSession } from "./session.entity.js";
import { User as BaseUser } from "./user.entity.js";
import { Verification as BaseVerification } from "./verification.entity.js";
import { Workspace as BaseWorkspace } from "./workspace.entity.js";

const TestAccount = BaseAccount;
type TestAccount = BaseAccount;
const TestVerification = BaseVerification;
type TestVerification = BaseVerification;

describe("auth entities", () => {
  it.each([
    [undefined, []],
    ["", []],
    ["openid", ["openid"]],
    ["openid,profile,email", ["openid", "profile", "email"]],
    ["openid profile\temail", ["openid", "profile", "email"]],
    [" , openid, profile\nemail ,, ", ["openid", "profile", "email"]],
  ] as const)("parses persisted OAuth scopes %j", (scope, expected) => {
    const account = Object.assign(new BaseAccount(), { scope });
    expect(account.scopes).toEqual(expected);
  });

  it("declares relations directly against built-in classes", () => {
    for (const [entity, field, target] of [
      [BaseUser, "members", "Member"],
      [BaseWorkspace, "members", "Member"],
      [BaseMember, "user", "User"],
      [BaseMember, "workspace", "Workspace"],
      [BaseInvitation, "inviter", "User"],
      [BaseInvitation, "workspace", "Workspace"],
      [BaseApiKey, "user", "User"],
      [BaseApiKey, "workspace", "Workspace"],
      [BaseAccount, "user", "User"],
      [BaseSession, "user", "User"],
      [BaseSession, "impersonatedBy", "User"],
    ] as const) {
      const metadata = Object.values(MetadataStorage.getMetadata()).find(
        (meta) => meta.class === entity,
      );
      const relation = metadata?.properties[field].entity;
      expect(typeof relation).toBe("function");
      expect(typeof relation === "function" ? relation().name : undefined).toBe(
        target,
      );
    }
  });

  it("should initialize generated ids and timestamps", () => {
    const account = new TestAccount();
    const apiKey = new BaseApiKey();
    const session = new BaseSession();
    const user = new BaseUser();
    const verification = new TestVerification();
    const workspace = new BaseWorkspace();
    const invitation = new BaseInvitation();
    const member = new BaseMember();

    for (const entity of [
      account,
      apiKey,
      session,
      user,
      verification,
      workspace,
      invitation,
      member,
    ]) {
      expect(entity.id).toEqual(expect.any(String));
      expect(entity.createdAt).toBeInstanceOf(Date);
      if ("updatedAt" in entity) {
        expect(entity.updatedAt).toBeInstanceOf(Date);
      }
    }
    expect(apiKey.user).toBeNull();
    expect(apiKey.workspace).toBeNull();
    expect(apiKey).not.toHaveProperty("owner");
    expect(apiKey.enabled).toBe(true);
    expect(apiKey.permissions).toEqual([]);
    expect(user.permissions).toEqual([]);
    expect(user.roles).toEqual(["user"]);
    expect(user.banned).toBe(false);
    expect(user.banReason).toBeNull();
    expect(user.banExpiresAt).toBeNull();
    expect(workspace.deletedAt).toBeNull();
    expect(invitation.status).toBe("pending");
    expect(member.permissions).toEqual([]);
    expect(member.roles).toEqual(["member"]);
    expect(member.status).toBe("ACTIVE");
    expect(member.email).toBeNull();
    expect(member).not.toHaveProperty("type");
    expect(user.members).toBeInstanceOf(Collection);
    expect(workspace.members).toBeInstanceOf(Collection);
    expect(workspace).not.toHaveProperty("features");
  });

  it("declares shared profiles and membership relations on the base entities", () => {
    const properties = (entity: object) =>
      Object.values(MetadataStorage.getMetadata()).find(
        (meta) => meta.class === entity,
      )?.properties;
    expect(properties(BaseMember)?.name).toMatchObject({
      name: "name",
    });
    expect(properties(BaseMember)?.email).toMatchObject({
      name: "email",
      nullable: true,
    });
    expect(properties(BaseUser)?.members).toMatchObject({
      mappedBy: "user",
    });
    expect(properties(BaseWorkspace)?.members).toMatchObject({
      mappedBy: "workspace",
    });
  });

  it("declares database cascades and exactly one API-key owner", () => {
    const metadata = (entity: object) => {
      const meta = Object.values(MetadataStorage.getMetadata()).find(
        (meta) => meta.class === entity,
      );
      if (!meta) throw new Error("Missing entity metadata");
      return meta;
    };
    for (const [entity, fields] of [
      [BaseAccount, ["user"]],
      [BaseSession, ["user", "impersonatedBy"]],
      [BaseApiKey, ["user", "workspace"]],
      [BaseMember, ["user", "workspace"]],
      [BaseInvitation, ["inviter", "workspace"]],
    ] as const) {
      for (const field of fields) {
        expect(metadata(entity).properties[field].deleteRule).toBe("cascade");
        expect(metadata(entity).properties[field].cascade ?? []).not.toContain(
          "remove",
        );
      }
    }
    const key = metadata(BaseApiKey);
    expect(key.properties.user.nullable).toBe(true);
    expect(key.properties.workspace.nullable).toBe(true);
    const expression = key.checks[0].expression;
    expect(typeof expression).toBe("function");
    if (typeof expression === "function") {
      expect(
        expression(
          { user: "custom_user", workspace: "custom_workspace" } as never,
          {} as never,
        ),
      ).toBe('("custom_user" is not null) <> ("custom_workspace" is not null)');
    }
  });

  it("should load entities in an isolated module", async () => {
    vi.resetModules();

    expect((await import("./account.entity.js")).Account).toBeDefined();
    expect((await import("./api-key.entity.js")).ApiKey).toBeDefined();
    expect((await import("./session.entity.js")).Session).toBeDefined();
    expect((await import("./user.entity.js")).User).toBeDefined();
    expect(
      (await import("./verification.entity.js")).Verification,
    ).toBeDefined();
    expect((await import("./member.entity.js")).Member).toBeDefined();
    expect((await import("./invitation.entity.js")).Invitation).toBeDefined();
    expect((await import("./workspace.entity.js")).Workspace).toBeDefined();
  });

  it("should pass relation names and update callbacks to MikroORM decorators", async () => {
    const relationTargets: unknown[] = [];
    const updateValues: unknown[] = [];
    const decorator = () => () => undefined;

    vi.resetModules();
    vi.doMock("@mikro-orm/decorators/legacy", async () => {
      const actual = await vi.importActual<
        typeof import("@mikro-orm/decorators/legacy")
      >("@mikro-orm/decorators/legacy");

      return {
        ...actual,
        Entity: decorator,
        Index: decorator,
        ManyToOne: (target: () => { name: string }) => {
          relationTargets.push(target);
          return () => undefined;
        },
        PrimaryKey: decorator,
        Property: (options: { onUpdate?: () => unknown } = {}) => {
          if (options.onUpdate) {
            updateValues.push(options.onUpdate());
          }
          return () => undefined;
        },
        Unique: decorator,
      };
    });

    await import("./account.entity.js");
    await import("./api-key.entity.js");
    await import("./session.entity.js");
    await import("./user.entity.js");
    await import("./verification.entity.js");
    await import("./member.entity.js");
    await import("./invitation.entity.js");
    await import("./workspace.entity.js");
    vi.doUnmock("@mikro-orm/decorators/legacy");

    expect(
      relationTargets
        .map((target) => (target as () => { name: string })().name)
        .sort(),
    ).toEqual(
      [
        "User",
        "User",
        "Workspace",
        "User",
        "User",
        "User",
        "Workspace",
        "User",
        "Workspace",
      ].sort(),
    );
    expect(updateValues).toHaveLength(7);
    expect(updateValues.every((value) => value instanceof Date)).toBe(true);
  });
});
