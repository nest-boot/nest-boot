import { Collection, MetadataStorage, t } from "@mikro-orm/core";

import { Account } from "./account.entity.js";
import { entities } from "./index.js";
import { Invitation } from "./invitation.entity.js";
import { Member } from "./member.entity.js";
import { Session } from "./session.entity.js";
import { User } from "./user.entity.js";
import { UserApiKey } from "./user-api-key.entity.js";
import { Verification } from "./verification.entity.js";
import { Workspace } from "./workspace.entity.js";
import { WorkspaceApiKey } from "./workspace-api-key.entity.js";

describe("auth entities", () => {
  it("keeps role and permission columns as arrays, independent of GraphQL enums", () => {
    for (const [entity, fields] of [
      [User, ["roles", "permissions"]],
      [Member, ["roles", "permissions"]],
      [Invitation, ["roles"]],
      [UserApiKey, ["permissions"]],
      [WorkspaceApiKey, ["permissions"]],
    ] as const) {
      const metadata = Object.values(MetadataStorage.getMetadata()).find(
        (meta) => meta.class === entity,
      );
      for (const field of fields)
        expect(metadata?.properties[field].type).toBe(t.array);
    }
  });
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
    const apiKey = new WorkspaceApiKey();
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
    expect(apiKey).not.toHaveProperty("user");
    expect(apiKey.workspace).toBeUndefined();
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

  it.each([
    [UserApiKey, "user", "workspace"],
    [WorkspaceApiKey, "workspace", "user"],
  ] as const)(
    "gives %s only its required owner relation",
    (entity, owner, other) => {
      const metadata = Object.values(MetadataStorage.getMetadata()).find(
        (meta) => meta.class === entity,
      );
      expect(metadata?.properties[owner].nullable ?? false).toBe(false);
      expect(metadata?.properties[other]).toBeUndefined();
      expect(metadata?.checks ?? []).toEqual([]);
    },
  );

  it.each([
    Account,
    UserApiKey,
    WorkspaceApiKey,
    Member,
    Session,
    User,
    Verification,
    Workspace,
  ])(
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
    [UserApiKey, "user", User, { ref: true, deleteRule: "cascade" }],
    [
      WorkspaceApiKey,
      "workspace",
      Workspace,
      { ref: true, deleteRule: "cascade" },
    ],
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
    [UserApiKey, ["user", "permissions"]],
    [WorkspaceApiKey, ["workspace", "permissions"]],
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
