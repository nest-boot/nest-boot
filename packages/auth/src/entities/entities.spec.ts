import { Collection, MetadataStorage } from "@mikro-orm/core";

import { Account } from "./account.entity.js";
import { ApiKey } from "./api-key.entity.js";
import { entities } from "./index.js";
import { Invitation } from "./invitation.entity.js";
import { Member } from "./member.entity.js";
import { Session } from "./session.entity.js";
import { User } from "./user.entity.js";
import { Verification } from "./verification.entity.js";
import { Workspace } from "./workspace.entity.js";

describe("auth entities", () => {
  it.each([
    [undefined, []],
    ["", []],
    ["openid", ["openid"]],
    ["openid,profile,email", ["openid", "profile", "email"]],
    ["openid profile\temail", ["openid", "profile", "email"]],
    [" , openid, profile\nemail ,, ", ["openid", "profile", "email"]],
  ] as const)("parses persisted OAuth scopes %j", (scope, expected) => {
    const account = Object.assign(new Account(), { scope });
    expect(account.scopes).toEqual(expected);
  });

  it("should initialize generated ids and timestamps", () => {
    const account = new Account();
    const apiKey = new ApiKey();
    const session = new Session();
    const user = new User();
    const verification = new Verification();
    const workspace = new Workspace();
    const invitation = new Invitation();
    const member = new Member();

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

  it("persists workspace-visible member profile fields", () => {
    const properties = (entity: object) =>
      Object.values(MetadataStorage.getMetadata()).find(
        (meta) => meta.class === entity,
      )?.properties;
    expect(properties(Member)?.name).toMatchObject({
      name: "name",
    });
    expect(properties(Member)?.email).toMatchObject({
      name: "email",
      nullable: true,
    });
  });

  it("requires exactly one API-key owner", () => {
    const metadata = (entity: object) => {
      const meta = Object.values(MetadataStorage.getMetadata()).find(
        (meta) => meta.class === entity,
      );
      if (!meta) throw new Error("Missing entity metadata");
      return meta;
    };
    const key = metadata(ApiKey);
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

  it.each([Account, ApiKey, Member, Session, User, Verification, Workspace])(
    "%s refreshes its update timestamp through real ORM metadata",
    (entity) => {
      const property = Object.values(MetadataStorage.getMetadata()).find(
        (meta) => meta.class === entity,
      )?.properties.updatedAt;
      expect(property?.onUpdate).toEqual(expect.any(Function));
      expect(property?.onUpdate?.(new entity(), {} as never)).toBeInstanceOf(
        Date,
      );
    },
  );
});

describe("built-in auth entity field ownership", () => {
  it.each([
    [User, "members", Member, { mappedBy: "user" }],
    [Workspace, "members", Member, { mappedBy: "workspace" }],
    [Member, "user", User, { deleteRule: "cascade" }],
    [Member, "workspace", Workspace, { deleteRule: "cascade" }],
    [Invitation, "inviter", User, { deleteRule: "cascade" }],
    [Invitation, "workspace", Workspace, { deleteRule: "cascade" }],
    [ApiKey, "user", User, { nullable: true, deleteRule: "cascade" }],
    [ApiKey, "workspace", Workspace, { nullable: true, deleteRule: "cascade" }],
    [Account, "user", User, { ref: true, deleteRule: "cascade" }],
    [Session, "user", User, { ref: true, deleteRule: "cascade" }],
    [
      Session,
      "impersonatedBy",
      User,
      { nullable: true, deleteRule: "cascade" },
    ],
  ] as const)(
    "%s.%s targets the built-in class",
    (entity, field, target, options) => {
      const metadata = Object.values(MetadataStorage.getMetadata());
      const property = metadata.find((meta) => meta.class === entity)
        ?.properties[field];
      expect(property).toMatchObject(options);
      expect(property?.cascade ?? []).not.toContain("remove");
      if (typeof property?.entity !== "function")
        throw new Error("Missing class relation");
      expect(property.entity()).toBe(target);
    },
  );

  it.each([
    [Account, ["issuer", "accountId", "user"]],
    [ApiKey, ["user", "workspace", "permissions"]],
    [Session, ["user", "token", "expiresAt"]],
    [User, ["name", "email", "members"]],
    [Verification, ["identifier", "value"]],
    [Workspace, ["name", "members"]],
    [Invitation, ["email", "workspace", "inviter"]],
    [Member, ["name", "email", "user", "workspace"]],
  ] as const)("%s owns its persistence fields", (entity, fields) => {
    expect(entities).toContain(entity);
    const metadata = Object.values(MetadataStorage.getMetadata()).find(
      (meta) => meta.class === entity,
    );
    expect(metadata?.abstract).not.toBe(true);
    for (const field of fields)
      expect(metadata?.properties).toHaveProperty(field);
  });
});
